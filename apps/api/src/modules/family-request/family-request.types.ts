import type { Clock } from "@/common/clock.lib.ts";
import type { MembershipRepo } from "@/modules/auth";
import type { BotApi } from "@/modules/telegram";

import type { FamilyRequestRepo } from "./family-request.repo.ts";

export type FamilyRequestDependencies = {
  requests: FamilyRequestRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  clock: Clock;
  operatorTelegramId: number;
  miniAppUrl: string;
};
