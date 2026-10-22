import type { PhotoSize } from "@grammyjs/types";

import type { PhotoVariants } from "@/common/db";
import type { BotApi } from "@/common/telegram";

type UploadedPhoto = { fileUniqueId: string; variants: PhotoVariants };

// Where photo files live: today each Family's Telegram channel (ADR 0002), later perhaps R2.
export type PhotoFiles = {
  upload(channelId: number, file: Blob): Promise<UploadedPhoto>;
  open(fileId: string): Promise<Response>;
};

const thumbSide = 320;
const mediumSide = 1280;

function closestTo(sizes: PhotoSize[], side: number): PhotoSize | undefined {
  return sizes.toSorted(
    (left, right) =>
      Math.abs(Math.max(left.width, left.height) - side) -
      Math.abs(Math.max(right.width, right.height) - side),
  )[0];
}

function fileIdOf(size: PhotoSize | undefined): string {
  return size?.file_id ?? "";
}

// Telegram keeps a few sizes of each photo; the app stores the three it shows.
function uploadedOf(sizes: PhotoSize[]): UploadedPhoto {
  const largest = sizes.toSorted((left, right) => right.width - left.width)[0];

  return {
    fileUniqueId: largest?.file_unique_id ?? "",
    variants: {
      thumb: fileIdOf(closestTo(sizes, thumbSide)),
      medium: fileIdOf(closestTo(sizes, mediumSide)),
      full: fileIdOf(largest),
    },
  };
}

export function createTelegramPhotoFiles(bot: BotApi): PhotoFiles {
  return {
    async upload(channelId, file) {
      const message = await bot.call("sendPhoto", { chat_id: channelId, photo: file });

      return uploadedOf(message.photo);
    },
    async open(fileId) {
      const file = await bot.call("getFile", { file_id: fileId });

      return bot.file(file.file_path ?? "");
    },
  };
}
