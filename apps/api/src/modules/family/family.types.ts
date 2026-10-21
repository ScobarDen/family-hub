import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { FamilyRepo } from "./family.repo.ts";

// Wired by the app to the reminder module, which owns the Reminders of whoever leaves.
export type FamilySchedule = { membershipChanged(familyId: string): Promise<void> };

export type FamilyDependencies = {
  families: FamilyRepo;
  schedule: FamilySchedule;
  bot: BotApi;
  clock: Clock;
};
