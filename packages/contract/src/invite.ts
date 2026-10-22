import { z } from "zod";

import { telegramLogin } from "./primitive.ts";

export const inviteTokenPattern = /^[A-Za-z0-9_-]{22}$/;

export const inviteToken = z.string().regex(inviteTokenPattern);

export const invite = z.object({
  id: z.string(),
  link: z.string(),
  expiresAt: z.number(),
});

export type Invite = z.infer<typeof invite>;

export const inviteCreated = invite.extend({ preparedMessageId: z.string().nullable() });

export type InviteCreated = z.infer<typeof inviteCreated>;

export const inviteList = z.array(invite);

export type InviteList = z.infer<typeof inviteList>;

export const inviteRevoked = z.object({ status: z.literal("revoked") });

export type InviteRevoked = z.infer<typeof inviteRevoked>;

export const inviteRequest = telegramLogin;

export const invitePreview = z.discriminatedUnion("status", [
  z.object({ status: z.literal("open"), inviterName: z.string(), familyName: z.string() }),
  z.object({ status: z.literal("unavailable") }),
  z.object({ status: z.literal("in-other-family") }),
  z.object({ status: z.literal("in-this-family") }),
]);

export type InvitePreview = z.infer<typeof invitePreview>;

export const inviteAccepted = z.object({ status: z.literal("joined") });

export type InviteAccepted = z.infer<typeof inviteAccepted>;
