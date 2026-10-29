import type { CommandModel, CommandModels } from "@family-hub/commands";

import type { Clock } from "@/common/clock.lib.ts";
import type { MembershipRepo } from "@/modules/auth";
import type { CareEntryService } from "@/modules/care-entry";
import type { MiniAppLinks } from "@/modules/mini-app-link";
import type { TaskService } from "@/modules/task";
import type { BotApi } from "@/modules/telegram";

import type { CommandRepo } from "./command.repo.ts";

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
type TaskCreation = Pick<TaskService, "create">;

type CareEntryCreation = Pick<CareEntryService, "create">;

export type CommandDependencies = {
  drafts: CommandRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
  model: CommandModel;
  models: CommandModels;
  speechModel: string;
  commandsPerFamilyDay: number;
  tasks: TaskCreation;
  careEntries: CareEntryCreation;
};
