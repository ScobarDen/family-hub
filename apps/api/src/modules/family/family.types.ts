import type { Clock } from "@/common/clock.lib.ts";
import type { BotApi } from "@/modules/telegram";

import type { FamilyRepo } from "./family.repo.ts";

type FamilySchedule = { membershipChanged(familyId: string): Promise<void> };

export type FamilyDependencies = {
  families: FamilyRepo;
  schedule: FamilySchedule;
  bot: BotApi;
  clock: Clock;
};
