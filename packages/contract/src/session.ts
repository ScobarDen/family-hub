import { z } from "zod";

import { familyRequestStatus } from "./family-request.ts";
import { memberSettings } from "./member.ts";

export const sessionRequest = z.object({
  initData: z.string().min(1),
});

export const sessionResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("member"), token: z.string() }),
  z.object({ status: z.literal("stranger"), familyRequest: familyRequestStatus }),
]);

export type SessionResponse = z.infer<typeof sessionResponse>;

export const currentMember = z.object({
  member: z.object({ id: z.string(), name: z.string() }),
  family: z.object({ id: z.string(), name: z.string() }),
  isFamilyOwner: z.boolean(),
  settings: memberSettings,
});

export type CurrentMember = z.infer<typeof currentMember>;
