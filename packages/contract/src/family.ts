import { z } from "zod";

import { deleted } from "./primitive.ts";

export const familyLeft = z.object({ status: z.enum(["left", "family-deleted"]) });

export type FamilyLeft = z.infer<typeof familyLeft>;

export const memberRemoved = z.object({ status: z.literal("removed") });

export type MemberRemoved = z.infer<typeof memberRemoved>;

export const familyOwnerChange = z.object({ memberId: z.string().min(1) });

export type FamilyOwnerChange = z.infer<typeof familyOwnerChange>;

export const familyOwnerChanged = z.object({ status: z.literal("handed-over") });

export type FamilyOwnerChanged = z.infer<typeof familyOwnerChanged>;

export const familyDeletion = z.object({ familyName: z.string() });

export type FamilyDeletion = z.infer<typeof familyDeletion>;

export const familyDeleted = deleted;

export type FamilyDeleted = z.infer<typeof familyDeleted>;
