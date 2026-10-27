import { encodeRecordLink, type ReminderOffset } from "@family-hub/contract";
import {
  daysAfter,
  firstOccurrenceFrom,
  occurrenceMoment,
  taskReminderMoment,
} from "@family-hub/recurrence";

import type { TaskRecord, TaskRow, TaskTree } from "@/modules/task";

import {
  daySnoozeMs,
  formatFloatingDate,
  formatMomentIn,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "../reminder.lib.ts";
import type { ReminderDependencies, Source, SourceHolder } from "../reminder.types.ts";

// The Occurrences still to remind of: skipped and Completed ones are left out.
function seriesSteps(root: TaskRecord, date: string) {
  const { row } = root;
  const recurrence = row.frequency === null ? null : { frequency: row.frequency, until: row.until };
  const closed = new Set([
    ...row.skippedDates,
    ...root.completions.map(({ occurrence }) => occurrence),
  ]);

  function from(day: string): string | undefined {
    const occurrence = firstOccurrenceFrom(date, recurrence, day);

    return occurrence !== undefined && closed.has(occurrence)
      ? from(daysAfter(occurrence, 1))
      : occurrence;
  }

  return { first: from, next: (occurrence: string) => from(daysAfter(occurrence, 1)) };
}

function titleOf(row: TaskRow, { occurrence, timeZone }: { occurrence: string; timeZone: string }) {
  if (row.time === null || row.timeZone === null) {
    return `${row.title} · ${formatFloatingDate(occurrence)}`;
  }

  const moment = occurrenceMoment(occurrence, { time: row.time, timeZone: row.timeZone });

  return `${row.title} · ${formatMomentIn(moment, timeZone)}`;
}

// The Assignees by default, or the owner of a Task without them; a Private Task reaches its owner.
async function recipientsOf({ sources }: ReminderDependencies, { root }: TaskTree) {
  const { row } = root;
  const owner = row.ownerMemberId === null ? [] : [row.ownerMemberId];

  if (row.recipientsMode === "members") {
    return root.recipients.map(({ id }) => id);
  }

  if (row.recipientsMode === "everyone") {
    return row.visibility === "private" ? owner : sources.memberIdsOf(row.familyId);
  }

  return root.assignees.length > 0 ? root.assignees.map(({ id }) => id) : owner;
}

type Sourcing = { offset: ReminderOffset; recipientIds: string[]; chatLink: string | undefined };

function taskSource(
  dependencies: ReminderDependencies,
  { tree, date, sourcing }: { tree: TaskTree; date: string; sourcing: Sourcing },
): Source {
  const { row } = tree.root;
  const { offset, recipientIds, chatLink } = sourcing;
  const isTimed = row.time !== null;

  function recordUrlOf(occurrence: string): string | undefined {
    return chatLink === undefined
      ? undefined
      : `${chatLink}?startapp=${encodeRecordLink({ taskId: row.id, occurrence })}`;
  }

  return {
    kind: "task",
    sourceId: sourceIdOf(row.id, offset),
    recipientIds,
    homeZone: row.timeZone ?? undefined,
    ...seriesSteps(tree.root, date),
    fireAt: (occurrence, timeZone) =>
      taskReminderMoment(occurrence, { when: row, offset, recipientZone: timeZone }),
    emoji: row.petId === null ? "📌" : "🐾",
    title: (occurrence, timeZone) => titleOf(row, { occurrence, timeZone }),
    buttons: (dispatchId, occurrence) =>
      reminderButtons(dispatchId, { recordUrl: recordUrlOf(occurrence) }),
    closesForEveryone: true,
    complete: async (presser, occurrence) => {
      const { status } = await dependencies.tasks.complete(presser, { taskId: row.id, occurrence });

      return status === "ok";
    },
    snoozeMs: isTimed ? snoozeMs : daySnoozeMs,
    isSkippedWhenLate: true,
  };
}

// A Completed single Task and an Archived Pet's Tasks remind of nothing.
async function isSilent(
  { sources }: ReminderDependencies,
  { tree, familyId }: { tree: TaskTree; familyId: string },
): Promise<boolean> {
  const { row, completions } = tree.root;

  if (row.frequency === null && completions.length > 0) {
    return true;
  }

  const pet = row.petId === null ? undefined : await sources.pet({ familyId, id: row.petId });

  return pet !== undefined && pet.archivedAt !== null;
}

// Each offset of a Task is a source of its own, so «Готово» on one leaves the others; a Pet-linked
// Task offers to record a Care Entry.
export async function taskSources(
  dependencies: ReminderDependencies,
  { familyId, id }: SourceHolder,
): Promise<Source[]> {
  const tree = await dependencies.tasks.findTree(familyId, id);
  const date = tree?.root.row.date ?? null;

  if (tree === undefined || date === null || (await isSilent(dependencies, { tree, familyId }))) {
    return [];
  }

  const { row } = tree.root;
  const recipientIds = await recipientsOf(dependencies, tree);
  const chatLink = row.petId === null ? undefined : await dependencies.appLinks.chatLink();

  return row.reminderOffsets.map((offset) =>
    taskSource(dependencies, { tree, date, sourcing: { offset, recipientIds, chatLink } }),
  );
}
