import { z } from "zod";

import { telegramLogin } from "./primitive.ts";

export const familyNameMaxLength = 64;

export const familyRequestBody = telegramLogin.extend({
  familyName: z.string().trim().min(1).max(familyNameMaxLength),
});

export const familyRequestStatus = z.enum(["none", "pending", "cooldown"]);

export type FamilyRequestStatus = z.infer<typeof familyRequestStatus>;

export const familyRequestCreated = z.object({ status: z.literal("pending") });

export type FamilyRequestCreated = z.infer<typeof familyRequestCreated>;
