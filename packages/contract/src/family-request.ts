import { z } from "zod";

export const familyNameMaxLength = 64;

export const familyRequestBody = z.object({
  initData: z.string().min(1),
  familyName: z.string().trim().min(1).max(familyNameMaxLength),
});

export type FamilyRequestBody = z.infer<typeof familyRequestBody>;

export const familyRequestCreated = z.object({ status: z.literal("pending") });

export type FamilyRequestCreated = z.infer<typeof familyRequestCreated>;
