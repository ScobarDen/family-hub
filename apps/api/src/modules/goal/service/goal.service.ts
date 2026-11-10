import type { GoalChange, GoalOutcome, MovementChange } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Membership } from "@/modules/auth";
import { reportingChanges } from "@/modules/live";

import type { GoalDependencies } from "../goal.types.ts";
import { complete, create, list, update } from "./goal-root.service.ts";
import { addMovement, removeMovement, updateMovement } from "./movement.service.ts";

type MovementTarget = { goalId: string; movementId: string };

export function createGoalService(dependencies: GoalDependencies) {
  const commands = {
    ...bindFirst(dependencies, { create, removeMovement }),
    update: async (membership: Membership, goalId: string, change: GoalChange) =>
      update(dependencies, membership, { goalId, change }),
    complete: async (membership: Membership, goalId: string, outcome: GoalOutcome) =>
      complete(dependencies, membership, { goalId, outcome }),
    addMovement: async (membership: Membership, goalId: string, change: MovementChange) =>
      addMovement(dependencies, membership, { goalId, change }),
    updateMovement: async (
      membership: Membership,
      target: MovementTarget,
      change: MovementChange,
    ) => updateMovement(dependencies, membership, { ...target, change }),
  };

  return {
    ...bindFirst(dependencies, { list }),
    ...reportingChanges(dependencies.live, { modules: ["goals"], commands }),
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
