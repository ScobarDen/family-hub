import { z } from "zod";

import { familyRequestStatus } from "./family-request.ts";
import { memberSettings } from "./member.ts";
import { named } from "./primitive.ts";

export const currentMember = z.object({
  member: named,
  family: named,
  isFamilyOwner: z.boolean(),
  settings: memberSettings,
});

export type CurrentMember = z.infer<typeof currentMember>;

export const sessionToken = z.object({ token: z.string() });

export type SessionToken = z.infer<typeof sessionToken>;

export const sessionResponse = z.discriminatedUnion("status", [
  currentMember.extend(sessionToken.shape).extend({ status: z.literal("member") }),
  z.object({ status: z.literal("stranger"), familyRequest: familyRequestStatus }),
]);

export type SessionResponse = z.infer<typeof sessionResponse>;
