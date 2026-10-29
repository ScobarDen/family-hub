import type { Task } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { PhotoLinks } from "@/common/photo-link.lib.ts";
import type { MembershipRepo } from "@/modules/auth";
import type { MiniAppLinks } from "@/modules/mini-app-link";
import type { BotApi } from "@/modules/telegram";

import type { TaskRepo } from "./task.repo.ts";

// The Reminders of a Task are rewritten whenever it, its Subtasks or its completions change.
type TaskSchedule = {
  sourceChanged(familyId: string, source: { kind: "task"; id: string }): Promise<void>;
};

export type TaskDependencies = {
  tasks: TaskRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
  schedule: TaskSchedule;
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
