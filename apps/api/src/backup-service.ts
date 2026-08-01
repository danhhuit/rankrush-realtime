import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "./config.js";
import { redis } from "./redis.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backupDirectory = config.BACKUP_DIR
  ? path.resolve(config.BACKUP_DIR)
  : path.resolve(here, "../../../backups");
const backupLockKey = `${config.REDIS_PREFIX}:admin:backup-lock`;
const backupSuffix = ".rrbackup.json";

const backupRecordSchema = z.object({
  key: z.string().min(1),
  ttlMs: z.number().int().min(-1),
  dumpBase64: z.string().min(1),
});

const backupMetadataSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().max(80),
  reason: z.enum(["MANUAL", "PRE_RESTORE"]),
  createdAt: z.string().datetime(),
  namespace: z.string().min(1),
  appVersion: z.string().min(1),
  keyCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

const backupDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  metadata: backupMetadataSchema,
  records: z.array(backupRecordSchema),
});

type BackupDocument = z.infer<typeof backupDocumentSchema>;
type BackupRecord = z.infer<typeof backupRecordSchema>;
export type BackupSummary = z.infer<typeof backupMetadataSchema>;

const backupError = (message: string, code: string, status = 400) =>
  Object.assign(new Error(message), { code, status });

export function assertBackupId(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id))
    throw backupError("Mã bản sao lưu không hợp lệ.", "BACKUP_ID_INVALID");
  return id;
}

export function calculateBackupChecksum(input: {
  schemaVersion: number;
  namespace: string;
  records: BackupRecord[];
}) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function backupPath(id: string) {
  return path.join(backupDirectory, `${assertBackupId(id)}${backupSuffix}`);
}

async function scanNamespaceKeys() {
  let cursor = "0";
  const foundKeys: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${config.REDIS_PREFIX}:*`,
      "COUNT",
      500,
    );
    cursor = nextCursor;
    for (const key of keys) if (key !== backupLockKey) foundKeys.push(key);
    if (foundKeys.length > config.BACKUP_MAX_KEYS)
      throw backupError(
        `Namespace có hơn ${config.BACKUP_MAX_KEYS.toLocaleString()} key, vượt giới hạn sao lưu.`,
        "BACKUP_TOO_LARGE",
        413,
      );
  } while (cursor !== "0");
  return foundKeys.sort();
}

async function captureRecords(keys: string[]) {
  const records: BackupRecord[] = [];
  for (let offset = 0; offset < keys.length; offset += 200) {
    const batch = keys.slice(offset, offset + 200);
    const rows = await Promise.all(
      batch.map(async (key) => {
        const [dump, ttlMs] = await Promise.all([
          redis.dumpBuffer(key),
          redis.pttl(key),
        ]);
        return dump
          ? {
              key,
              ttlMs,
              dumpBase64: dump.toString("base64"),
            }
          : null;
      }),
    );
    records.push(...rows.filter((row): row is BackupRecord => Boolean(row)));
  }
  return records;
}

function verifyDocument(document: BackupDocument) {
  if (document.metadata.namespace !== config.REDIS_PREFIX)
    throw backupError(
      `Bản sao thuộc namespace “${document.metadata.namespace}”, không phải “${config.REDIS_PREFIX}”.`,
      "BACKUP_NAMESPACE_MISMATCH",
      409,
    );
  if (document.metadata.keyCount !== document.records.length)
    throw backupError(
      "Số lượng key trong bản sao không khớp.",
      "BACKUP_CORRUPTED",
      422,
    );
  for (const record of document.records)
    if (
      !record.key.startsWith(`${config.REDIS_PREFIX}:`) ||
      record.key === backupLockKey
    )
      throw backupError(
        "Bản sao chứa key nằm ngoài namespace cho phép.",
        "BACKUP_CORRUPTED",
        422,
      );
  const checksum = calculateBackupChecksum({
    schemaVersion: document.schemaVersion,
    namespace: document.metadata.namespace,
    records: document.records,
  });
  if (checksum !== document.metadata.checksum)
    throw backupError(
      "Checksum của bản sao không hợp lệ. Tệp có thể đã bị thay đổi.",
      "BACKUP_CHECKSUM_INVALID",
      422,
    );
  return document;
}

async function readBackupDocument(id: string) {
  let content: string;
  try {
    content = await readFile(backupPath(id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw backupError("Không tìm thấy bản sao lưu.", "BACKUP_NOT_FOUND", 404);
    throw error;
  }
  try {
    return verifyDocument(backupDocumentSchema.parse(JSON.parse(content)));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError)
      throw backupError(
        "Tệp sao lưu không đúng định dạng.",
        "BACKUP_CORRUPTED",
        422,
      );
    throw error;
  }
}

async function withBackupLock<T>(operation: () => Promise<T>) {
  const token = randomBytes(16).toString("hex");
  const acquired = await redis.set(
    backupLockKey,
    token,
    "PX",
    5 * 60_000,
    "NX",
  );
  if (acquired !== "OK")
    throw backupError(
      "Một thao tác sao lưu hoặc phục hồi khác đang chạy.",
      "BACKUP_BUSY",
      409,
    );
  try {
    return await operation();
  } finally {
    await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      backupLockKey,
      token,
    );
  }
}

async function createBackupInternal(
  label: string,
  reason: BackupSummary["reason"],
) {
  await mkdir(backupDirectory, { recursive: true });
  const records = await captureRecords(await scanNamespaceKeys());
  const createdAt = new Date().toISOString();
  const id = `${createdAt.replace(/[-:.TZ]/g, "")}-${randomBytes(4).toString("hex")}`;
  const checksum = calculateBackupChecksum({
    schemaVersion: 1,
    namespace: config.REDIS_PREFIX,
    records,
  });
  const document: BackupDocument = {
    schemaVersion: 1,
    metadata: {
      id,
      label: label.trim().slice(0, 80) || "Bản sao thủ công",
      reason,
      createdAt,
      namespace: config.REDIS_PREFIX,
      appVersion: process.env.npm_package_version || "1.0.0",
      keyCount: records.length,
      sizeBytes: 0,
      checksum,
    },
    records,
  };
  let content = JSON.stringify(document);
  document.metadata.sizeBytes = Buffer.byteLength(content);
  content = JSON.stringify(document);
  document.metadata.sizeBytes = Buffer.byteLength(content);
  content = JSON.stringify(document);
  const target = backupPath(id);
  const temporary = `${target}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return document.metadata;
}

export async function createBackup(
  label = "Bản sao thủ công",
  reason: BackupSummary["reason"] = "MANUAL",
) {
  return withBackupLock(() => createBackupInternal(label, reason));
}

export async function listBackups() {
  await mkdir(backupDirectory, { recursive: true });
  const names = (await readdir(backupDirectory)).filter((name) =>
    name.endsWith(backupSuffix),
  );
  const rows = await Promise.all(
    names.map(async (name) => {
      try {
        const id = name.slice(0, -backupSuffix.length);
        const document = await readBackupDocument(id);
        const fileStat = await stat(backupPath(id));
        return { ...document.metadata, sizeBytes: fileStat.size };
      } catch {
        return null;
      }
    }),
  );
  return rows
    .filter((row): row is BackupSummary => Boolean(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function clearNamespace() {
  const keys = await scanNamespaceKeys();
  for (let offset = 0; offset < keys.length; offset += 500) {
    const batch = keys.slice(offset, offset + 500);
    if (batch.length) await redis.unlink(...batch);
  }
}

async function restoreDocument(document: BackupDocument) {
  verifyDocument(document);
  await clearNamespace();
  for (let offset = 0; offset < document.records.length; offset += 200) {
    const pipeline = redis.pipeline();
    for (const record of document.records.slice(offset, offset + 200))
      pipeline.restore(
        record.key,
        record.ttlMs > 0 ? record.ttlMs : 0,
        Buffer.from(record.dumpBase64, "base64"),
        "REPLACE",
      );
    const results = await pipeline.exec();
    const failed = results?.find(([error]) => error);
    if (failed?.[0]) throw failed[0];
  }
}

export async function restoreBackup(id: string) {
  return withBackupLock(async () => {
    const target = await readBackupDocument(id);
    const safetyBackup = await createBackupInternal(
      `Tự động trước khi phục hồi ${target.metadata.label}`,
      "PRE_RESTORE",
    );
    try {
      await restoreDocument(target);
    } catch (restoreError) {
      try {
        await restoreDocument(await readBackupDocument(safetyBackup.id));
      } catch (rollbackError) {
        throw Object.assign(
          new Error(
            "Phục hồi thất bại và không thể tự hoàn tác. Hãy dùng bản sao an toàn vừa tạo.",
          ),
          {
            status: 500,
            code: "BACKUP_ROLLBACK_FAILED",
            cause: { restoreError, rollbackError },
          },
        );
      }
      throw backupError(
        "Phục hồi thất bại; dữ liệu ban đầu đã được tự động khôi phục.",
        "BACKUP_RESTORE_FAILED",
        500,
      );
    }
    return {
      restoredAt: new Date().toISOString(),
      restoredKeys: target.records.length,
      backup: target.metadata,
      safetyBackup,
    };
  });
}

export async function deleteBackup(id: string) {
  return withBackupLock(async () => {
    await readBackupDocument(id);
    await unlink(backupPath(id));
  });
}

export async function getBackupDownload(id: string) {
  await readBackupDocument(id);
  return {
    path: backupPath(id),
    // Keep Content-Disposition ASCII-only; the user-facing label remains in
    // the JSON metadata and the browser UI supplies its own download name.
    filename: `rankrush-${assertBackupId(id)}${backupSuffix}`,
  };
}
