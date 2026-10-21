import { action, computed, withAsyncData, wrap } from "@reatom/core";

import type { Plan } from "@family-hub/contract";

import type { PlansApi } from "./plans.api.ts";

function byDueDate(left: Plan, right: Plan): number {
  if (left.dueDate === right.dueDate) {
    return 0;
  }

  if (left.dueDate === null || right.dueDate === null) {
    return left.dueDate === null ? 1 : -1;
  }

  return left.dueDate < right.dueDate ? -1 : 1;
}

export function reatomPlans({ api }: { api: PlansApi }) {
  const list = computed(async () => wrap(api.list()), "plans.list").extend(withAsyncData());

  return {
    list,
    members: computed(async () => wrap(api.members()), "plans.members").extend(withAsyncData()),
    pets: computed(async () => wrap(api.pets()), "plans.pets").extend(withAsyncData()),

    keep: action((saved: Plan) => {
      const others = (list.data() ?? []).filter(({ id }) => id !== saved.id);

      list.data.set([...others, saved].toSorted(byDueDate));
    }, "plans.keep"),
    drop: action((planId: string) => {
      list.data.set(list.data()?.filter(({ id }) => id !== planId));
    }, "plans.drop"),
  };
}

export type PlansModel = ReturnType<typeof reatomPlans>;
