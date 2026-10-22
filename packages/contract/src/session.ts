import { z } from "zod";

import { familyRequestStatus } from "./family-request.ts";
import { memberSettings } from "./member.ts";
import { named, telegramLogin } from "./primitive.ts";

export const sessionRequest = telegramLogin;

export const sessionResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("member"), token: z.string() }),
  z.object({ status: z.literal("stranger"), familyRequest: familyRequestStatus }),
]);

export type SessionResponse = z.infer<typeof sessionResponse>;

export const currentMember = z.object({
  member: named,
  family: named,
  isFamilyOwner: z.boolean(),
  settings: memberSettings,
});

export type CurrentMember = z.infer<typeof currentMember>;
