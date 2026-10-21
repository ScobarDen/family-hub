import type { Membership, TelegramUser } from "@/common/auth";

import type { InviteDependencies } from "../invite.types.ts";
import { accept, preview } from "./joining.service.ts";
import { create, listOpen, revoke } from "./sharing.service.ts";

export type { AcceptResult } from "./joining.service.ts";
export type { RevokeResult } from "./sharing.service.ts";

export function createInviteService(dependencies: InviteDependencies) {
  return {
    create: async (membership: Membership) => create(dependencies, membership),
    listOpen: async (membership: Membership) => listOpen(dependencies, membership),
    revoke: async (membership: Membership, inviteId: string) =>
      revoke(dependencies, membership, inviteId),
    preview: async (user: TelegramUser, token: string) => preview(dependencies, user, token),
    accept: async (user: TelegramUser, token: string) => accept(dependencies, user, token),
    sweep: async () => dependencies.invites.sweep(dependencies.clock.now()),
  };
}

export type InviteService = ReturnType<typeof createInviteService>;
