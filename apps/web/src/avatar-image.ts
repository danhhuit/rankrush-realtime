const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_RESULT_BYTES = 512 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type AvatarImageErrorCode =
  | "AVATAR_FILE_TOO_LARGE"
  | "AVATAR_FILE_UNSUPPORTED"
  | "AVATAR_IMAGE_INVALID"
  | "AVATAR_RESULT_TOO_LARGE";

export class AvatarImageError extends Error {
  constructor(public readonly code: AvatarImageErrorCode) {
    super(code);
    this.name = "AvatarImageError";
  }
}

function dataUrlByteLength(value: string) {
  const encoded = value.slice(value.indexOf(",") + 1);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarImageError("AVATAR_IMAGE_INVALID"));
    };
    image.src = url;
  });
}

function renderSquare(
  image: HTMLImageElement,
  size: number,
  mime: "image/webp" | "image/jpeg",
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new AvatarImageError("AVATAR_IMAGE_INVALID");

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL(mime, quality);
}

export async function createAvatarDataUrl(file: File) {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarImageError("AVATAR_FILE_TOO_LARGE");
  }
  if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new AvatarImageError("AVATAR_FILE_UNSUPPORTED");
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new AvatarImageError("AVATAR_IMAGE_INVALID");
  }

  for (const size of [512, 384, 256]) {
    for (const quality of [0.88, 0.78, 0.68, 0.58]) {
      const result = renderSquare(image, size, "image/webp", quality);
      if (
        result.startsWith("data:image/webp;base64,") &&
        dataUrlByteLength(result) <= MAX_RESULT_BYTES
      ) {
        return result;
      }
    }
  }

  for (const quality of [0.82, 0.7, 0.58, 0.46]) {
    const result = renderSquare(image, 256, "image/jpeg", quality);
    if (
      result.startsWith("data:image/jpeg;base64,") &&
      dataUrlByteLength(result) <= MAX_RESULT_BYTES
    ) {
      return result;
    }
  }

  throw new AvatarImageError("AVATAR_RESULT_TOO_LARGE");
}
