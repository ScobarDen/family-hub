import { planReminderMoment } from "@family-hub/recurrence";

import { daySnoozeMs, formatFloatingDate, planButtons, sourceIdOf } from "../reminder.lib.ts";
import type { SourceHolder, ReminderDependencies, Source } from "../reminder.types.ts";
import type { PlanRow } from "../repo/source.repo.ts";

type PlanStep = { root: PlanRow; row: PlanRow };

// A deadline comes once.
function noNextOccurrence(): undefined {
  return undefined;
}

function titleOf({ root, row }: PlanStep): string {
  return row.id === root.id ? row.title : `${root.title}: ${row.title}`;
}

// The Assignee is the one to do it; with nobody assigned it is everyone's, a Private one its owner's.
async function recipientsOf({ sources }: ReminderDependencies, { root, row }: PlanStep) {
  if (row.assigneeMemberId !== null) {
    return [row.assigneeMemberId];
  }

  return root.visibility === "private" && root.ownerMemberId !== null
    ? [root.ownerMemberId]
    : sources.memberIdsOf(root.familyId);
}

async function planSource(
  dependencies: ReminderDependencies,
  step: PlanStep,
): Promise<Source | undefined> {
  const { dueDate, reminder: lead, completedAt, id } = step.row;

  if (dueDate === null || lead === null || completedAt !== null) {
    return undefined;
  }

  return {
    kind: "plan",
    sourceId: sourceIdOf(step.root.id, id),
    recipientIds: await recipientsOf(dependencies, step),
    homeZone: undefined,
    first: (day) => (dueDate >= day ? dueDate : undefined),
    next: noNextOccurrence,
    fireAt: (occurrence, timeZone) =>
      planReminderMoment(occurrence, { lead, recipientZone: timeZone }),
    emoji: "📌",
    title: (occurrence) => `${titleOf(step)} · до ${formatFloatingDate(occurrence)}`,
    buttons: planButtons,
    closesForEveryone: true,
    complete: async (presser) => {
      await dependencies.plans.completeById(presser, id);
    },
    snoozeMs: daySnoozeMs,
    isSkippedWhenLate: false,
  };
}

export async function planSources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<Source[]> {
  const rows = await dependencies.sources.planTree(holder);
  const root = rows.find(({ id }) => id === holder.id);

  if (root === undefined) {
    return [];
  }

  const sources = await Promise.all(
    rows.map(async (row) => planSource(dependencies, { root, row })),
  );

  return sources.filter((source) => source !== undefined);
}
