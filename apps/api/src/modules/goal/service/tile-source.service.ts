import type { TileSource } from "@/modules/today";

import { balanceOf } from "../goal.lib.ts";
import type { GoalRepo, GoalRow } from "../goal.repo.ts";

const percentMax = 100;

// Goals without a deadline come after every dated one.
function byDeadline(left: GoalRow, right: GoalRow): number {
  if (left.deadline === right.deadline) {
    return 0;
  }

  if (left.deadline === null || right.deadline === null) {
    return left.deadline === null ? 1 : -1;
  }

  return left.deadline.localeCompare(right.deadline);
}

export function createGoalTile({ goals }: { goals: GoalRepo }): TileSource<"goals"> {
  return {
    tile: async ({ family, member }) => {
      const visible = await goals.listVisible({ familyId: family.id, memberId: member.id });
      const [nearest] = visible
        .filter(({ completedAt }) => completedAt === null)
        .toSorted(byDeadline);

      if (nearest === undefined) {
        return { nearest: null };
      }

      const movements = await goals.movementsOf(family.id, [nearest.id]);
      const percent = Math.floor((balanceOf(movements) / nearest.target) * percentMax);

      return {
        nearest: {
          goalId: nearest.id,
          title: nearest.title,
          percent: Math.min(percent, percentMax),
        },
      };
    },
  };
}
