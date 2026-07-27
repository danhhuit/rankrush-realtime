import { describe, expect, it } from "vitest";
import { assertBackupId, calculateBackupChecksum } from "./backup-service.js";

describe("backup-service", () => {
  it("accepts safe backup identifiers and rejects path traversal", () => {
    expect(assertBackupId("20260727T101500-a1b2c3d4")).toBe(
      "20260727T101500-a1b2c3d4",
    );
    expect(() => assertBackupId("../../secret")).toThrow(
      "Mã bản sao lưu không hợp lệ.",
    );
    expect(() => assertBackupId("backup.json")).toThrow();
  });

  it("creates a deterministic checksum and detects record changes", () => {
    const input = {
      schemaVersion: 1,
      namespace: "rankrush",
      records: [
        {
          key: "rankrush:users",
          ttlMs: -1,
          dumpBase64: "AAECAw==",
        },
      ],
    };
    const checksum = calculateBackupChecksum(input);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(calculateBackupChecksum(input)).toBe(checksum);
    expect(
      calculateBackupChecksum({
        ...input,
        records: [{ ...input.records[0]!, dumpBase64: "changed" }],
      }),
    ).not.toBe(checksum);
  });
});
