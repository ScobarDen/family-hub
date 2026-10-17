import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { FamilyRequestRepo } from "./family-request.repo.ts";

export type FamilyRequestDependencies = {
  requests: FamilyRequestRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  clock: Clock;
  operatorTelegramId: number;
};
