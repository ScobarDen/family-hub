import type { Task } from "@family-hub/contract";

import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { MiniAppLinks } from "@/common/mini-app-link";
import type { PhotoLinks } from "@/common/photo-link";
import type { BotApi } from "@/common/telegram";

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
  | "subtasks-not-allowed";

export type TaskResult = { status: "ok"; task: Task } | { status: TaskRefusal };

export type DeleteResult = { status: "deleted" } | { status: TaskRefusal };
