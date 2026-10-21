import type { Plan, Visibility } from "@family-hub/contract";

import type { Clock } from "@/common/clock";

import type { PlanRepo } from "./plan.repo.ts";

export type PlanDependencies = { plans: PlanRepo; clock: Clock };

export type PlanRefusal = "not-found" | "not-owner" | "assignee-not-allowed" | "visibility-one-way";

export type PlanResult = { status: "ok"; plan: Plan } | { status: PlanRefusal };

export type Assignment = { assigneeId: string | null; visibility: Visibility; ownerId: string };
