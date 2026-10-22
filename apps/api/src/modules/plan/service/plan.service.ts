import type { PlanChange, SubplanChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { PlanDependencies, PlanResult } from "../plan.types.ts";
import { complete, completeById, markSubplan, reopen } from "./completion.service.ts";
import { create, list, remove, update } from "./plan-root.service.ts";
import { addSubplan, removeSubplan, updateSubplan } from "./subplan.service.ts";

type SubplanTarget = { planId: string; subplanId: string };

function scheduling({ schedule }: PlanDependencies) {
  return async function rescheduled<Result>(
    { family }: Membership,
    { planId, result }: { planId: string; result: Result },
  ): Promise<Result> {
    await schedule.sourceChanged(family.id, { kind: "plan", id: planId });

    return result;
  };
}

function subplanCommands(dependencies: PlanDependencies) {
  const rescheduled = scheduling(dependencies);

  return {
    addSubplan: async (membership: Membership, planId: string, change: SubplanChange) =>
      rescheduled(membership, {
        planId,
        result: await addSubplan(dependencies, membership, { planId, change }),
      }),
    updateSubplan: async (membership: Membership, target: SubplanTarget, change: SubplanChange) =>
      rescheduled(membership, {
        planId: target.planId,
        result: await updateSubplan(dependencies, membership, { ...target, change }),
      }),
    removeSubplan: async (membership: Membership, target: SubplanTarget) =>
      rescheduled(membership, {
        planId: target.planId,
        result: await removeSubplan(dependencies, membership, target),
      }),
    markSubplan: async (membership: Membership, target: SubplanTarget, isDone: boolean) =>
      rescheduled(membership, {
        planId: target.planId,
        result: await markSubplan(dependencies, membership, { ...target, isDone }),
      }),
  };
}

export function createPlanService(dependencies: PlanDependencies) {
  const rescheduled = scheduling(dependencies);

  return {
    list: async (membership: Membership) => list(dependencies, membership),
    create: async (membership: Membership, change: PlanChange) => {
      const result = await create(dependencies, membership, change);

      return result.status === "ok"
        ? rescheduled(membership, { planId: result.plan.id, result })
        : result;
    },
    update: async (membership: Membership, planId: string, change: PlanChange) =>
      rescheduled(membership, {
        planId,
        result: await update(dependencies, membership, { planId, change }),
      }),
    remove: async (membership: Membership, planId: string) =>
      rescheduled(membership, { planId, result: await remove(dependencies, membership, planId) }),
    complete: async (membership: Membership, planId: string) =>
      rescheduled(membership, { planId, result: await complete(dependencies, membership, planId) }),
    reopen: async (membership: Membership, planId: string) =>
      rescheduled(membership, { planId, result: await reopen(dependencies, membership, planId) }),
    completeById: async (membership: Membership, planId: string): Promise<PlanResult> => {
      const result = await completeById(dependencies, membership, planId);

      return result.status === "ok"
        ? rescheduled(membership, { planId: result.plan.id, result })
        : result;
    },
    ...subplanCommands(dependencies),
  };
}

export type PlanService = ReturnType<typeof createPlanService>;
