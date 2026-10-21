import type { CommandModel, CommandModels } from "@family-hub/commands";
import type { ReminderChange } from "@family-hub/contract";

import type { Membership, MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { CommandRepo } from "./command.repo.ts";

// «Создать» goes through the same use case as the Mini App form; the app wires the reminder module.
export type ReminderCreation = {
  create(membership: Membership, change: ReminderChange): Promise<{ status: string }>;
};

export type CommandDependencies = {
  drafts: CommandRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  clock: Clock;
  model: CommandModel;
  models: CommandModels;
  speechModel: string;
  commandsPerFamilyDay: number;
  reminders: ReminderCreation;
};
