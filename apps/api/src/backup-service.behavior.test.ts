import { rm } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Entry = { dump: Buffer; ttlMs: number };
  const entries = new Map<string, Entry>();
  const backupDirectory = `/tmp/rankrush-backup-service-${process.pid}`;

  const redis = {
    scan: vi.fn(async () => [
      "0",
      [...entries.keys()].filter((key) => key.startsWith("rankrush_test:")),
    ]),
    dumpBuffer: vi.fn(async (key: string) => entries.get(key)?.dump ?? null),
    pttl: vi.fn(async (key: string) => entries.get(key)?.ttlMs ?? -2),
    set: vi.fn(async (key: string, value: string) => {
      if (entries.has(key)) return null;
      entries.set(key, { dump: Buffer.from(value), ttlMs: 300_000 });
      return "OK";
    }),
    eval: vi.fn(async (_script: string, _count: number, key: string) => {
      entries.delete(key);
      return 1;
    }),
    unlink: vi.fn(async (...keys: string[]) => {
      keys.forEach((key) => entries.delete(key));
      return keys.length;
    }),
    pipeline: vi.fn(() => {
      const operations: Array<{
        key: string;
        ttlMs: number;
        dump: Buffer;
      }> = [];
      const pipeline = {
        restore(key: string, ttlMs: number, dump: Buffer, _replace: string) {
          operations.push({ key, ttlMs, dump });
          return pipeline;
        },
        async exec() {
          operations.forEach((operation) =>
            entries.set(operation.key, {
              dump: operation.dump,
              ttlMs: operation.ttlMs || -1,
            }),
          );
          return operations.map(() => [null, "OK"]);
        },
      };
      return pipeline;
    }),
  };

  return { backupDirectory, entries, redis };
});

vi.mock("./config.js", () => ({
  config: {
    BACKUP_DIR: mocks.backupDirectory,
    BACKUP_MAX_KEYS: 1000,
    REDIS_PREFIX: "rankrush_test",
  },
}));

vi.mock("./redis.js", () => ({ redis: mocks.redis }));

import {
  createBackup,
  deleteBackup,
  getBackupDownload,
  listBackups,
  restoreBackup,
} from "./backup-service.js";

describe("backup-service behavior", () => {
  beforeEach(async () => {
    mocks.entries.clear();
    vi.clearAllMocks();
    await rm(mocks.backupDirectory, { force: true, recursive: true });
  });

  afterAll(async () => {
    await rm(mocks.backupDirectory, { force: true, recursive: true });
  });

  it("backs up namespaced keys and safely restores an older version", async () => {
    mocks.entries.set("rankrush_test:user:1", {
      dump: Buffer.from("original-user"),
      ttlMs: -1,
    });
    mocks.entries.set("rankrush_test:session:1", {
      dump: Buffer.from("original-session"),
      ttlMs: 12_000,
    });
    mocks.entries.set("another_app:key", {
      dump: Buffer.from("must-not-change"),
      ttlMs: -1,
    });

    const original = await createBackup("Trước buổi demo");
    expect(original.keyCount).toBe(2);

    mocks.entries.set("rankrush_test:user:1", {
      dump: Buffer.from("changed-user"),
      ttlMs: -1,
    });
    mocks.entries.set("rankrush_test:new-key", {
      dump: Buffer.from("new"),
      ttlMs: -1,
    });

    const result = await restoreBackup(original.id);

    expect(result.restoredKeys).toBe(2);
    expect(result.safetyBackup.reason).toBe("PRE_RESTORE");
    expect(mocks.entries.get("rankrush_test:user:1")?.dump.toString()).toBe(
      "original-user",
    );
    expect(mocks.entries.get("rankrush_test:session:1")?.ttlMs).toBe(12_000);
    expect(mocks.entries.has("rankrush_test:new-key")).toBe(false);
    expect(mocks.entries.get("another_app:key")?.dump.toString()).toBe(
      "must-not-change",
    );

    const backups = await listBackups();
    expect(backups).toHaveLength(2);
    expect(backups[0]?.reason).toBe("PRE_RESTORE");

    const download = await getBackupDownload(original.id);
    expect(download.filename).toBe(`rankrush-${original.id}.rrbackup.json`);

    await deleteBackup(original.id);
    expect((await listBackups()).map((backup) => backup.id)).not.toContain(
      original.id,
    );
  });
});
