import { describe, expect, it } from "vitest";
import { createAvatarDataUrl } from "./avatar-image";

function mockFile(type: string, size: number) {
  return { type, size } as File;
}

describe("createAvatarDataUrl", () => {
  it("rejects source images larger than 10 MB before decoding", async () => {
    await expect(
      createAvatarDataUrl(mockFile("image/png", 10 * 1024 * 1024 + 1)),
    ).rejects.toMatchObject({
      code: "AVATAR_FILE_TOO_LARGE",
    });
  });

  it("rejects unsupported image types before decoding", async () => {
    await expect(
      createAvatarDataUrl(mockFile("image/svg+xml", 100)),
    ).rejects.toMatchObject({
      code: "AVATAR_FILE_UNSUPPORTED",
    });
  });
});
