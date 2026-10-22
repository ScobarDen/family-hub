import { z } from "zod";

export const date = z.iso.date();

export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "HH:MM");

export const rubles = z.number().int().positive();

export const deleted = z.object({ status: z.literal("deleted") });

export type Deleted = z.infer<typeof deleted>;

export const named = z.object({ id: z.string(), name: z.string() });

export type Named = z.infer<typeof named>;

export const telegramLogin = z.object({ initData: z.string().min(1) });
