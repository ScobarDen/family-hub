import type { FeedActivity, FeedUpcoming } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { KeysetPage } from "@/common/keyset";
import type { ActivitySource, FeedWindow, UpcomingSource } from "@/modules/feed";

import type { PlanRepo } from "../plan.repo.ts";

type PlanFeedDependencies = { plans: PlanRepo };

function titleOf(step: { title: string }, root: { title: string } | null): string {
  return root === null ? step.title : `${root.title}: ${step.title}`;
}

async function activityBefore(
  { plans }: PlanFeedDependencies,
  { family, member }: Membership,
  page: KeysetPage,
): Promise<FeedActivity[]> {
  const rows = await plans.activityBefore({ familyId: family.id, memberId: member.id }, page);

  return rows.map((row) => ({
    kind: "plan",
    key: row.key,
    at: row.completedAt ?? 0,
    memberName: row.memberName ?? "",
    title: titleOf(row, row.rootTitle === null ? null : { title: row.rootTitle }),
    planId: row.rootId ?? row.id,
  }));
}

async function deadlinesWithin(
  { plans }: PlanFeedDependencies,
  { family, member }: Membership,
  { last }: FeedWindow,
): Promise<FeedUpcoming[]> {
  const trees = await plans.listVisible(family.id, member.id);

  return trees.flatMap(({ root, subplans }) =>
    [root, ...subplans].flatMap((step): FeedUpcoming[] =>
      step.dueDate === null || step.completedAt !== null || step.dueDate > last
        ? []
        : [
            {
              kind: "plan",
              key: `plan-${step.id}`,
              title: titleOf(step, step.id === root.id ? null : root),
              date: step.dueDate,
              planId: root.id,
              subplanId: step.id === root.id ? null : step.id,
            },
          ],
    ),
  );
}

export function createPlanFeed(
  dependencies: PlanFeedDependencies,
): ActivitySource & UpcomingSource {
  return {
    before: async (viewer, page) => activityBefore(dependencies, viewer, page),
    within: async (viewer, window) => deadlinesWithin(dependencies, viewer, window),
  };
}
