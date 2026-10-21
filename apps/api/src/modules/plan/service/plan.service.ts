import type { PlanChange, SubplanChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { PlanDependencies } from "../plan.types.ts";
import { complete, markSubplan, reopen } from "./completion.service.ts";
import { create, list, remove, update } from "./plan-root.service.ts";
import { addSubplan, removeSubplan, updateSubplan } from "./subplan.service.ts";

type SubplanTarget = { planId: string; subplanId: string };

export function createPlanService(dependencies: PlanDependencies) {
  return {
    list: async (membership: Membership) => list(dependencies, membership),
    create: async (membership: Membership, change: PlanChange) =>
      create(dependencies, membership, change),
    update: async (membership: Membership, planId: string, change: PlanChange) =>
      update(dependencies, membership, { planId, change }),
    remove: async (membership: Membership, planId: string) =>
      remove(dependencies, membership, planId),
    complete: async (membership: Membership, planId: string) =>
      complete(dependencies, membership, planId),
    reopen: async (membership: Membership, planId: string) =>
      reopen(dependencies, membership, planId),
    addSubplan: async (membership: Membership, planId: string, change: SubplanChange) =>
      addSubplan(dependencies, membership, { planId, change }),
    updateSubplan: async (membership: Membership, target: SubplanTarget, change: SubplanChange) =>
      updateSubplan(dependencies, membership, { ...target, change }),
    removeSubplan: async (membership: Membership, target: SubplanTarget) =>
      removeSubplan(dependencies, membership, target),
    markSubplan: async (membership: Membership, target: SubplanTarget, isDone: boolean) =>
      markSubplan(dependencies, membership, { ...target, isDone }),
  };
}

export type PlanService = ReturnType<typeof createPlanService>;
