import { bindFirst } from "@/common/bind.lib.ts";

import type { InviteDependencies } from "../invite.types.ts";
import { accept, preview } from "./joining.service.ts";
import { create, listOpen, revoke } from "./sharing.service.ts";

export type { AcceptResult } from "./joining.service.ts";
export type { RevokeResult } from "./sharing.service.ts";

export function createInviteService(dependencies: InviteDependencies) {
  return {
    ...bindFirst(dependencies, { create, listOpen, revoke, preview, accept }),
    sweep: async () => dependencies.invites.sweep(dependencies.clock.now()),
  };
}

export type InviteService = ReturnType<typeof createInviteService>;
