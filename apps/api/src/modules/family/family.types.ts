import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { FamilyRepo } from "./family.repo.ts";

export type FamilyDependencies = { families: FamilyRepo; bot: BotApi; clock: Clock };
