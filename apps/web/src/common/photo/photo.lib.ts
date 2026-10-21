import { photoMaxBytes, photoMaxSide, type Photo } from "@family-hub/contract";

import { readTakenAt } from "./exif.lib.ts";

export type PreparedPhoto = { file: Blob; takenAt: number | null };

export class PhotoTooLargeError extends Error {
  constructor() {
    super("A photo is at most 10 MB");
    this.name = "PhotoTooLargeError";
  }
}

const jpegQuality = 0.85;

async function compressed(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, photoMaxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );

  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality: jpegQuality });
}

// The moment of shooting is read before compression, which drops the Exif block.
export async function preparePhoto(file: Blob, timeZone: string): Promise<PreparedPhoto> {
  if (file.size > photoMaxBytes) {
    throw new PhotoTooLargeError();
  }

  const takenAt = readTakenAt(await file.arrayBuffer(), timeZone);

  return { file: await compressed(file), takenAt };
}

// The Worker signs paths of its own; the browser loads them from the Worker's origin.
export function resolvedPhoto(photo: Photo, url: (path: string) => string): Photo {
  return {
    ...photo,
    urls: {
      thumb: url(photo.urls.thumb),
      medium: url(photo.urls.medium),
      full: url(photo.urls.full),
    },
  };
}
