import type { Clock } from "@/common/clock.lib.ts";
import type { MembershipRepo } from "@/modules/auth";
import type { MiniAppLinks } from "@/modules/mini-app-link";
import type { BotApi } from "@/modules/telegram";

import type { InviteRepo } from "./invite.repo.ts";

type InviteSchedule = { membershipChanged(familyId: string): Promise<void> };

export type InviteDependencies = {
  invites: InviteRepo;
  memberships: MembershipRepo;
  // Wired by the app to the family-request module, which modules may not import directly.
  familyRequests: { cancelPending(telegramId: number): Promise<void> };
  schedule: InviteSchedule;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
};
