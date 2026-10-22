import { z } from "zod";

const photoStorageStatus = z.enum(["none", "connected", "disconnected"]);

export const photoStorage = z.object({
  status: photoStorageStatus,
  channelTitle: z.string().nullable(),
});

export type PhotoStorage = z.infer<typeof photoStorage>;
