import type { CommandModel, CommandModels } from "@family-hub/commands";

import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { MiniAppLinks } from "@/common/mini-app-link";
import type { BotApi } from "@/common/telegram";
import type { CareEntryService } from "@/modules/care-entry";
import type { EventService } from "@/modules/event";
import type { ReminderService } from "@/modules/reminder";

import type { CommandRepo } from "./command.repo.ts";

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
export type ReminderCreation = Pick<ReminderService, "create">;

export type EventCreation = Pick<EventService, "create">;

export type CareEntryCreation = Pick<CareEntryService, "create">;

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
  reminders: ReminderCreation;
  events: EventCreation;
  careEntries: CareEntryCreation;
};
