import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { InviteRepo } from "./invite.repo.ts";

// Wired by the app to the reminder module: a newcomer starts getting the Family's Reminders.
export type InviteSchedule = { membershipChanged(familyId: string): Promise<void> };

export type InviteDependencies = {
  invites: InviteRepo;
  memberships: MembershipRepo;
  // Wired by the app to the family-request module, which modules may not import directly.
  familyRequests: { cancelPending(telegramId: number): Promise<void> };
  schedule: InviteSchedule;
  bot: BotApi;
  clock: Clock;
};
