import { action } from "@reatom/core";

import { goalList, type FamilyMember, type Goal, type GoalList } from "@family-hub/contract";

import { rolledBackById, upserted } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import { reatomLiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";

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
  const list = reatomLiveResource({
    name: "goals.list",
    liveVersion,
    load: async () => api.list(),
    cache: {
      withDeviceCache: deviceCache.withDeviceCache,
      key: "goals",
      schema: goalList,
      version: 1,
    },
    rollback: { onRollback: rolledBackList },
  });

  return {
    list,
    reload: list.reload,
    members,

    // The total is the server's to count, so a saved Goal brings a fresh list with it.
    keep: action((saved: Goal) => {
      if (list.data() !== undefined) {
        list.change((current) => {
          const goals = upserted(current?.goals ?? [], saved);

          return { goals, totalSaved: totalOf(goals) };
        });
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
