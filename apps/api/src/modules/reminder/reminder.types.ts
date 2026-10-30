import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { DeepLink, FeedUpcoming, PushMessage } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { Membership, MembershipRepo } from "@/modules/auth";
import type { DispatchSource } from "@/modules/db";
import type { TaskTree } from "@/modules/task";
import type { MiniAppLinks, BotApi } from "@/modules/telegram";

import type { DispatchRepo } from "./repo/dispatch.repo.ts";
import type { FamilyHolderKind, SourceRepo } from "./repo/source.repo.ts";

// «✅ Готово» completes an Occurrence in the task module, which the app wires in with its reads.
type TaskPort = {
  findTree(familyId: string, taskId: string): Promise<TaskTree | undefined>;
  complete(
    membership: Membership,
    target: { taskId: string; occurrence: string | null },
  ): Promise<{ status: string }>;
};

// The digest reads the Feed of its Member; the app wires the feed module in.
type DigestContent = {
  contentOf(
    memberId: string,
  ): Promise<{ overdue: FeedUpcoming[]; today: FeedUpcoming[] } | undefined>;
};

type PushPress = { dispatchId: string; occurrence: string | null };

// Push is its own module; the app wires in sending to every Device of a Recipient and reading
// back the press a Push's button sent.
type PushPort = {
  sendTo(
    memberId: string,
    sending: { message: Omit<PushMessage, "pressToken">; press?: PushPress },
  ): Promise<number>;
  pressOf(token: string): Promise<(PushPress & { memberId: string }) | undefined>;
};

export type PushText = Pick<PushMessage, "title" | "body">;

export type ReminderDependencies = {
  push: PushPort;
  digests: DigestContent;
  tasks: TaskPort;
  dispatch: DispatchRepo;
  sources: SourceRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
};

export type HolderKind = FamilyHolderKind | "member";

export type SourceHolder = { familyId: string; id: string };

export type ChangedSource = { kind: "task" | "pet"; id: string };

// What a dispatch row reminds of, read the same way for every kind of source: its Occurrences on a
// Recipient's calendar, the moment each one fires and what the message says.
export type Source = {
  kind: DispatchSource;
  sourceId: string;
  recipientIds: string[];
  // The zone the source was set in, for Recipients whose own zone is not known yet.
  homeZone: string | undefined;
  first: (fromDay: string) => string | undefined;
  next: (occurrence: string) => string | undefined;
  fireAt: (occurrence: string, timeZone: string) => number;
  emoji: string;
  title: (occurrence: string, timeZone: string) => string;
  buttons: (dispatchId: string, occurrence: string) => InlineKeyboardMarkup;
  // The record a Push opens; without one it opens the app.
  deepLink?: DeepLink;
  closesForEveryone: boolean;
  // False when the source refused, so the messages are left as they were.
  complete?: (presser: Membership, occurrence: string | null) => Promise<boolean>;
  // A message body built when it is due, under the title; nothing to say means nothing is sent.
  compose?: (occurrence: string, timeZone: string) => Promise<string | undefined>;
  // A Push says what in its title and when in its body; without it the title is the whole line.
  pushOf?: (occurrence: string, timeZone: string) => PushText;
  snoozeMs: number;
  isSkippedWhenLate: boolean;
};
