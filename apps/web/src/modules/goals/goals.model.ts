import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import { goalList, type FamilyMember, type Goal } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { LiveVersion } from "@/common/live-updates";
import { upserted } from "@/common/records";

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

  list.data.extend(deviceCache.withDeviceCache({ key: "goals", schema: goalList, version: 1 }));

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

// Shared Goals and the Member's own Private ones count; a Completed Goal no longer does.
export function totalOf(goals: Goal[]): number {
  let total = 0;

  for (const { completed, balance } of goals) {
    total += completed === null ? balance : 0;
  }

  return total;
}

export type GoalsModel = ReturnType<typeof reatomGoals>;
