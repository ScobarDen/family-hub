import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { InviteRepo } from "./invite.repo.ts";

export type InviteDependencies = {
  invites: InviteRepo;
  memberships: MembershipRepo;
  // Wired by the app to the family-request module, which modules may not import directly.
  familyRequests: { cancelPending(telegramId: number): Promise<void> };
  bot: BotApi;
  clock: Clock;
  miniAppLink: string;
};
