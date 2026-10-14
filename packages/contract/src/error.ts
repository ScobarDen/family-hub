import { z } from "zod";

export const errorCode = z.enum(["INVALID_REQUEST", "INIT_DATA_INVALID", "UNAUTHENTICATED"]);

export type ErrorCode = z.infer<typeof errorCode>;

export const apiError = z.object({
  code: errorCode,
  message: z.string(),
});

export type ApiError = z.infer<typeof apiError>;
