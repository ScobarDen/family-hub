import type { Plan, Visibility } from "@family-hub/contract";

import type { MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { MiniAppLinks } from "@/common/mini-app-link";
import type { PhotoLinks } from "@/common/photo-link";
import type { BotApi } from "@/common/telegram";

import type { PlanRepo } from "./plan.repo.ts";

// The Reminders of a Plan tree are rewritten whenever the Plan or any of its Subplans changes.
export type PlanSchedule = {
  sourceChanged(familyId: string, source: { kind: "plan"; id: string }): Promise<void>;
};

export type PlanDependencies = {
  plans: PlanRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
  schedule: PlanSchedule;
  links: PhotoLinks;
};

export type PlanRefusal =
  | "not-found"
  | "not-owner"
  | "assignee-not-allowed"
  | "visibility-one-way"
  | "pet-not-found"
  | "album-not-found";

export type PlanResult = { status: "ok"; plan: Plan } | { status: PlanRefusal };

export type Assignment = { assigneeId: string | null; visibility: Visibility; ownerId: string };
