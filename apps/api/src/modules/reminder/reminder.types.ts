import type { Reminder } from "@family-hub/contract";

import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { BotApi } from "@/common/telegram";

import type { DispatchRepo } from "./repo/dispatch.repo.ts";
import type { ReminderRepo } from "./repo/reminder.repo.ts";

export type ReminderDependencies = {
  reminders: ReminderRepo;
  dispatch: DispatchRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  clock: Clock;
};

export type ReminderRefusal =
  | "not-found"
  | "not-owner"
  | "visibility-one-way"
  | "recipients-not-allowed";

export type ReminderResult = { status: "ok"; reminder: Reminder } | { status: ReminderRefusal };
