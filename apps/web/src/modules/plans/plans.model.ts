import { action, computed, withAsyncData, wrap } from "@reatom/core";

import type { FamilyMember, Pet, Plan } from "@family-hub/contract";

import { byDueDate, upserted, withoutId } from "@/common/records";

import type { PlansApi } from "./plans.api.ts";

export type SharedLists = {
  members: { data: () => FamilyMember[] | undefined };
  pets: { data: () => Pet[] | undefined };
};

export function reatomPlans({ api, members, pets }: { api: PlansApi } & SharedLists) {
  const list = computed(async () => wrap(api.list()), "plans.list").extend(withAsyncData());

  return {
    list,
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
