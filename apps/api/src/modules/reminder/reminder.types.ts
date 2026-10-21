import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { FeedUpcoming, Reminder } from "@family-hub/contract";

import type { Membership, MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { DispatchSource } from "@/common/db";
import type { MiniAppLinks } from "@/common/mini-app-link";
import type { BotApi } from "@/common/telegram";

import type { DispatchRepo } from "./repo/dispatch.repo.ts";
import type { ReminderRepo } from "./repo/reminder.repo.ts";
import type { SourceRepo } from "./repo/source.repo.ts";

// «✅ Выполнено» on a Plan's Reminder completes it in the plan module, which the app wires in.
export type PlanCompletion = {
  completeById(membership: Membership, planId: string): Promise<unknown>;
};

// The digest reads the Feed of its Member; the app wires the feed module in.
export type DigestContent = {
  contentOf(
    memberId: string,
  ): Promise<{ overdue: FeedUpcoming[]; today: FeedUpcoming[] } | undefined>;
};

export type ReminderDependencies = {
  digests: DigestContent;
  plans: PlanCompletion;
  reminders: ReminderRepo;
  dispatch: DispatchRepo;
  sources: SourceRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
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
  // A message built when it is due; nothing to say means nothing is sent.
  compose?: (occurrence: string, timeZone: string) => Promise<string | undefined>;
  snoozeMs: number;
  isSkippedWhenLate: boolean;
};
