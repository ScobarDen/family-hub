import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { Reminder } from "@family-hub/contract";

import type { Membership, MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { DispatchSource } from "@/common/db";
import type { BotApi } from "@/common/telegram";

import type { DispatchRepo } from "./repo/dispatch.repo.ts";
import type { ReminderRepo } from "./repo/reminder.repo.ts";
import type { SourceRepo } from "./repo/source.repo.ts";

// «✅ Выполнено» on a Plan's Reminder completes it in the plan module, which the app wires in.
export type PlanCompletion = {
  completeById(membership: Membership, planId: string): Promise<unknown>;
};

export type ReminderDependencies = {
  plans: PlanCompletion;
  reminders: ReminderRepo;
  dispatch: DispatchRepo;
  sources: SourceRepo;
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

// What a dispatch row reminds of, read the same way for every kind of source: its Occurrences on a
// Recipient's calendar, the moment each one fires and what the message says.
export type Source = {
  kind: DispatchSource;
  familyId: string;
  sourceId: string;
  recipientIds: string[];
  // The zone the source was set in, for Recipients whose own zone is not known yet.
  homeZone: string | undefined;
  first: (fromDay: string) => string | undefined;
  next: (occurrence: string) => string | undefined;
  fireAt: (occurrence: string, timeZone: string) => number;
  emoji: string;
  title: (occurrence: string, timeZone: string) => string;
  buttons: (dispatchId: string) => InlineKeyboardMarkup;
  closesForEveryone: boolean;
  complete?: (presser: Membership) => Promise<void>;
  snoozeMs: number;
  isSkippedWhenLate: boolean;
};
