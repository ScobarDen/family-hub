import type { Goal } from "@family-hub/contract";

import type { Clock } from "@/common/clock";

import type { GoalRepo } from "./goal.repo.ts";

export type GoalDependencies = { goals: GoalRepo; clock: Clock };

export type GoalRefusal =
  | "not-found"
  | "completed"
  | "visibility-one-way"
  | "movement-not-found"
  | "not-author"
  | "balance-negative"
  | "contributor-not-allowed";

export type GoalResult = { status: "ok"; goal: Goal } | { status: GoalRefusal };
