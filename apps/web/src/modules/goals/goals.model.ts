import { action, computed, withAsyncData, wrap } from "@reatom/core";

import type { FamilyMember, Goal } from "@family-hub/contract";

import { upserted } from "@/common/records";

import type { GoalsApi } from "./goals.api.ts";

export function reatomGoals({
  api,
  members,
}: {
  api: GoalsApi;
  members: { data: () => FamilyMember[] | undefined };
}) {
  const list = computed(async () => wrap(api.list()), "goals.list").extend(withAsyncData());

  return {
    list,
    members,

    // The total is the server's to count, so a saved Goal brings a fresh list with it.
    keep: action((saved: Goal) => {
      const current = list.data();

      if (current !== undefined) {
        const goals = upserted(current.goals, saved);

        list.data.set({ goals, totalSaved: totalOf(goals) });
      }
    }, "goals.keep"),
  };
}

// Shared Goals and the Member's own Private ones count; a Completed Goal no longer does.
export function totalOf(goals: Goal[]): number {
  let total = 0;

  for (const { completed, balance } of goals) {
    total += completed === null ? balance : 0;
  }

  return total;
}

export type GoalsModel = ReturnType<typeof reatomGoals>;
