import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import type { FamilyMember, Pet, Plan } from "@family-hub/contract";

import type { LiveVersion } from "@/common/live-updates";
import { byDueDate, upserted, withoutId } from "@/common/records";

import type { PlansApi } from "./plans.api.ts";

export type SharedLists = {
  members: { data: () => FamilyMember[] | undefined };
  pets: { data: () => Pet[] | undefined };
};

export function reatomPlans({
  api,
  members,
  pets,
  liveVersion,
}: { api: PlansApi } & SharedLists & LiveVersion) {
  const version = atom(0, "plans.version");
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list());
  }, "plans.list").extend(withAsyncData());

  return {
    list,
    reload: action(() => {
      version.set(version() + 1);
    }, "plans.reload"),
    members,
    pets,
    albums: computed(async () => wrap(api.albums()), "plans.albums").extend(withAsyncData()),

    keep: action((saved: Plan) => {
      list.data.set(upserted(list.data() ?? [], saved).toSorted(byDueDate));
    }, "plans.keep"),
    drop: action((planId: string) => {
      list.data.set(withoutId(list.data() ?? [], planId));
    }, "plans.drop"),
  };
}

export type PlansModel = ReturnType<typeof reatomPlans>;
