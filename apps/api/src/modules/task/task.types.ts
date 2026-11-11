import type { Task } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { MembershipRepo } from "@/modules/auth";
import type { LiveChanges } from "@/modules/live";
import type { PhotoLinks } from "@/modules/photo";
import type { MiniAppLinks, BotApi } from "@/modules/telegram";

import type { TaskRepo } from "./task.repo.ts";

export type CompletedOccurrence = {
  taskId: string;
  occurrence: string;
  by: { id: string; name: string };
};

export type ReopenedOccurrence = Omit<CompletedOccurrence, "by">;

// The Reminders of a Task are rewritten whenever it or its Subtasks change; a completed or reopened
// Occurrence also tells its sent messages (ADR 0021).
type TaskSchedule = {
  sourceChanged(familyId: string, source: { kind: "task"; id: string }): Promise<void>;
  occurrenceCompleted(familyId: string, completed: CompletedOccurrence): Promise<void>;
  occurrenceReopened(familyId: string, reopened: ReopenedOccurrence): Promise<void>;
};

export type TaskDependencies = {
  tasks: TaskRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
  schedule: TaskSchedule;
  live: LiveChanges;
  links: PhotoLinks;
};

export type TaskRefusal =
  | "not-found"
  | "not-owner"
  | "assignee-not-allowed"
  | "recipients-not-allowed"
  | "visibility-one-way"
  | "pet-not-found"
  | "album-not-found"
  | "subtasks-not-allowed"
  | "not-an-occurrence";

export type OccurrenceOf = { taskId: string; occurrence: string | null };

export type SubtaskTarget = { taskId: string; subtaskId: string };

export type TaskResult = { status: "ok"; task: Task } | { status: TaskRefusal };

export type DeleteResult = { status: "deleted" } | { status: TaskRefusal };
