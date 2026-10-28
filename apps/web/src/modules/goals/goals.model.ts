import { action, atom, computed, withAsyncData, withRollback, wrap } from "@reatom/core";

import { goalList, type FamilyMember, type Goal, type GoalList } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { LiveVersion } from "@/common/live-updates";
import { rolledBackById, upserted } from "@/common/records";

import type { GoalsApi } from "./goals.api.ts";

export function reatomGoals({
  api,
  members,
  liveVersion,
  deviceCache,
}: {
  api: GoalsApi;
  members: { data: () => FamilyMember[] | undefined };
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
} & LiveVersion) {
  const version = atom(0, "goals.version");
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list());
  }, "goals.list").extend(withAsyncData());

  list.data.extend(
    deviceCache.withDeviceCache({ key: "goals", schema: goalList, version: 1 }),
    withRollback({ onRollback: rolledBackList }),
  );

  return {
    list,
    reload: action(() => {
      version.set(version() + 1);
    }, "goals.reload"),
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

type ListStates = {
  beforeState: GoalList;
  transactionState: GoalList;
  currentState: GoalList;
};

// A failed change brings back its own Goal only, keeping one changed meanwhile.
function rolledBackList({ beforeState, transactionState, currentState }: ListStates) {
  const goals = rolledBackById({
    beforeState: beforeState.goals,
    transactionState: transactionState.goals,
    currentState: currentState.goals,
  });

  return { goals, totalSaved: totalOf(goals) };
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
