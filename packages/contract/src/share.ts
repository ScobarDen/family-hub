import { z } from "zod";

export const preparedMessage = z.object({ preparedMessageId: z.string() });

export type PreparedMessage = z.infer<typeof preparedMessage>;
