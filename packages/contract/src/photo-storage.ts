import { z } from "zod";

export const photoStorageStatus = z.enum(["none", "connected", "disconnected"]);

export type PhotoStorageStatus = z.infer<typeof photoStorageStatus>;

export const photoStorage = z.object({
  status: photoStorageStatus,
  channelTitle: z.string().nullable(),
});

export type PhotoStorage = z.infer<typeof photoStorage>;
