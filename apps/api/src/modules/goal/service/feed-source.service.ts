import type { FeedActivity } from "@family-hub/contract";

import { newestFirst, type KeysetPage } from "@/common/keyset.lib.ts";
import { formatRubles } from "@/common/money.lib.ts";
import type { Membership } from "@/modules/auth";
import type { ActivitySource } from "@/modules/feed";

import type { GoalRepo } from "../goal.repo.ts";

type GoalFeedDependencies = { goals: GoalRepo };

const outcomeTitles = { fulfilled: "Цель исполнена", cancelled: "Цель отменена" } as const;

async function activityBefore(
  { goals }: GoalFeedDependencies,
  { family, member }: Membership,
  page: KeysetPage,
): Promise<FeedActivity[]> {
  const viewer = { familyId: family.id, memberId: member.id };
  const [movements, closings] = await Promise.all([
    goals.movementsBefore(viewer, page),
    goals.closingsBefore(viewer, page),
  ]);

  return [
    ...movements.map((movement) => ({
      kind: "goal" as const,
      key: movement.key,
      at: movement.createdAt,
      memberName: movement.memberName,
      memberPicture: movement.memberPicture,
      title: `${movement.kind === "contribution" ? "+" : "−"}${formatRubles(movement.amount)} · ${movement.goalTitle}`,
      goalId: movement.goalId,
    })),
    ...closings.flatMap((goal) =>
      goal.outcome === null
        ? []
        : [
            {
              kind: "goal" as const,
              key: goal.key,
              at: goal.completedAt ?? 0,
              memberName: goal.memberName ?? "",
              memberPicture: goal.memberPicture,
              title: `${outcomeTitles[goal.outcome]}: ${goal.title}`,
              goalId: goal.goalId,
            },
          ],
    ),
  ]
    .toSorted(newestFirst)
    .slice(0, page.limit);
}

export function createGoalFeed(dependencies: GoalFeedDependencies): ActivitySource {
  return {
    before: async (viewer, page) => activityBefore(dependencies, viewer, page),
  };
}
