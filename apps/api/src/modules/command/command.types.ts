import type { CommandModel, CommandModels } from "@family-hub/commands";

import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { MiniAppLinks } from "@/common/mini-app-link";
import type { BotApi } from "@/common/telegram";
import type { CareEntryService } from "@/modules/care-entry";
import type { TaskService } from "@/modules/task";

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
