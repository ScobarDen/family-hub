import type { TileSource } from "@/modules/today";

import type { PlanRepo } from "../plan.repo.ts";

// A Plan is Overdue while any of its open steps is past its due date.
export function createPlanTile({ plans }: { plans: PlanRepo }): TileSource<"plans"> {
  return {
    tile: async ({ family, member }, { today }) => {
      const trees = await plans.listVisible(family.id, member.id);
      const open = trees.filter(({ root }) => root.completedAt === null);
      const overdue = open.filter(({ root, subplans }) =>
        [root, ...subplans].some(
          (step) => step.completedAt === null && step.dueDate !== null && step.dueDate < today,
        ),
      );

      return { open: open.length, overdue: overdue.length };
    },
  };
}
