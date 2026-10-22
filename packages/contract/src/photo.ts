import { z } from "zod";

import { deleted } from "./primitive.ts";

export const photoMaxBytes = 10_485_760;
export const photoMaxSide = 2560;
export const careEntryPhotoMax = 5;

export const photoVariant = z.enum(["thumb", "medium", "full"]);

export type PhotoVariant = z.infer<typeof photoVariant>;

// Each URL is the Worker's own, signed for a day: Telegram's file URLs would expose the bot token.
export const photoUrls = z.object({ thumb: z.string(), medium: z.string(), full: z.string() });

export type PhotoUrls = z.infer<typeof photoUrls>;

export const photo = z.object({
  id: z.string(),
  takenAt: z.number().nullable(),
  urls: photoUrls,
  canDelete: z.boolean(),
});

export type Photo = z.infer<typeof photo>;

export const photoDeleted = deleted;
