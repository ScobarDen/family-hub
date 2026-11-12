import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { DeepLink, FeedUpcoming, PushMessage } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { Membership, MembershipRepo } from "@/modules/auth";
import type { DispatchSource } from "@/modules/db";
import type { RemindingTask } from "@/modules/task";
import type { MiniAppLinks, BotApi } from "@/modules/telegram";

import type { DispatchRepo } from "./repo/dispatch.repo.ts";
import type { FamilyHolderKind, SourceRepo } from "./repo/source.repo.ts";

type TaskPort = {
  reminding(familyId: string, taskId: string): Promise<RemindingTask | undefined>;
};

// «✅ Готово» on a Task completes its Occurrence in the task module, handed in by the route that
// took the press, so the reminder module is built without it (ADR 0021).
export type TaskCompletion = {
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

// What «Готово» and «Отложить» on a Push name: its row and the Occurrence it showed.
export type PressTarget = { dispatchId: string; occurrence: string | null };

export type PushPressClaims = PressTarget & { memberId: string };

// Push is its own module; the app wires in sending to every Device of a Recipient and reading
// back the press a Push's button sent.
type PushPort = {
  sendTo(
    memberId: string,
    sending: { message: Omit<PushMessage, "pressToken">; press?: PressTarget },
  ): Promise<number>;
  pressOf(token: string): Promise<PushPressClaims | undefined>;
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

export type ReminderSchedule = {
  kind: DispatchSource;
  sourceId: string;
  recipientIds: string[];
  // The zone the source was set in, for Recipients whose own zone is not known yet.
  homeZone: string | undefined;
  first: (fromDay: string) => string | undefined;
  next: (occurrence: string) => string | undefined;
  fireAt: (occurrence: string, timeZone: string) => number;
};

// «Готово» completes a Task in the task module, closes a birthday on its rows here, and a Digest
// offers no «Готово» at all.
export type ReminderClosing =
  | { by: "task"; taskId: string; isClosed: (occurrence: string) => boolean }
  | { by: "row" }
  | { by: "none" };

export type ReminderContent =
  | { status: "headline" }
  | { status: "body"; body: string }
  | { status: "nothing-to-say" };

export type ReminderKind = {
  emoji: string;
  title: (occurrence: string, timeZone: string) => string;
  pushText: (
    occurrence: string,
    context: { timeZone: string; now: number; body: string | undefined },
  ) => PushText;
  buttons: (dispatchId: string, occurrence: string) => InlineKeyboardMarkup;
  // The record a Push opens; without one it opens the app.
  deepLink: DeepLink | undefined;
  closing: ReminderClosing;
  snoozeMs: number;
  // Read only when the Reminder is due: a Digest's body comes from the Feed.
  content: () => Promise<ReminderContent>;
};

export type ReminderSource = { schedule: ReminderSchedule; kind: ReminderKind };
