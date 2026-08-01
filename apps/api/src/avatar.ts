const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_PRESET_LENGTH = 64;

export type AvatarValidationIssue = "INVALID" | "TOO_LARGE";

function hasImageSignature(mime: string, bytes: Buffer) {
  if (mime === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mime === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mime === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

export function validateAvatarValue(
  value: string,
): AvatarValidationIssue | null {
  if (!value) return null;

  if (value.length > Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 64) {
    return "TOO_LARGE";
  }

  const dataUrl =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (dataUrl) {
    const encoded = dataUrl[2]!;
    if (encoded.length % 4 !== 0) return "INVALID";

    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length) return "INVALID";
    if (bytes.length > MAX_AVATAR_BYTES) return "TOO_LARGE";
    return hasImageSignature(dataUrl[1]!, bytes) ? null : "INVALID";
  }

  if (value.startsWith("data:")) return "INVALID";

  if (/^human\|[0-3]\|[0-3]\|[0-4]\|[0-3]$/.test(value)) {
    return null;
  }

  if (
    Array.from(value).length <= MAX_PRESET_LENGTH &&
    !/[\u0000-\u001f\u007f<>]/u.test(value)
  ) {
    return null;
  }

  return "INVALID";
}
