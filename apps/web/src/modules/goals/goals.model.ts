import { action, computed, withAsyncData, wrap } from "@reatom/core";

import type { Goal } from "@family-hub/contract";

import type { GoalsApi } from "./goals.api.ts";

export function reatomGoals({ api }: { api: GoalsApi }) {
  const list = computed(async () => wrap(api.list()), "goals.list").extend(withAsyncData());

  return {
    list,
    members: computed(async () => wrap(api.members()), "goals.members").extend(withAsyncData()),

    // The total is the server's to count, so a saved Goal brings a fresh list with it.
    keep: action((saved: Goal) => {
      const current = list.data();

      if (current !== undefined) {
        const goals = current.goals.map((goal) => (goal.id === saved.id ? saved : goal));
        const isNew = !current.goals.some(({ id }) => id === saved.id);

        list.data.set({
          goals: isNew ? [...goals, saved] : goals,
          totalSaved: totalOf(isNew ? [...goals, saved] : goals),
        });
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
