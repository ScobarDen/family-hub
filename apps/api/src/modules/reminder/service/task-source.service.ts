import { encodeRecordLink, type ReminderOffset } from "@family-hub/contract";
import {
  dateInZone,
  daysAfter,
  firstOccurrenceFrom,
  occurrenceMoment,
  taskReminderMoment,
  timeInZone,
} from "@family-hub/recurrence";

import type { TaskRecord, TaskRow, TaskTree } from "@/modules/task";

import {
  dayLabelOf,
  daySnoozeMs,
  formatFloatingDate,
  formatMomentIn,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "../reminder.lib.ts";
import type { PushText, ReminderDependencies, Source, SourceHolder } from "../reminder.types.ts";

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

// «Сегодня, 18:00» on the Recipient's clock, or the day alone for a date-only Task.
function whenOf(
  row: TaskRow,
  { occurrence, timeZone, now }: { occurrence: string; timeZone: string; now: number },
): string {
  const today = dateInZone(now, timeZone);

  if (row.time === null || row.timeZone === null) {
    return dayLabelOf(occurrence, today);
  }

  const moment = occurrenceMoment(occurrence, { time: row.time, timeZone: row.timeZone });

  return `${dayLabelOf(dateInZone(moment, timeZone), today)}, ${timeInZone(moment, timeZone)}`;
}

function pushTextOf(
  row: TaskRow,
  { section, ...when }: { occurrence: string; timeZone: string; now: number; section: string },
): PushText {
  return { title: row.title, body: `${whenOf(row, when)} · ${section}` };
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

type Sourcing = {
  offset: ReminderOffset;
  recipientIds: string[];
  chatLink: string;
  openUrl: string;
  section: string;
};

function taskSource(
  dependencies: ReminderDependencies,
  { tree, date, sourcing }: { tree: TaskTree; date: string; sourcing: Sourcing },
): Source {
  const { row } = tree.root;
  const { offset, recipientIds, chatLink, openUrl, section } = sourcing;
  const isTimed = row.time !== null;

  function recordUrlOf(occurrence: string): string | undefined {
    return row.petId === null
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
    pushOf: (occurrence, timeZone) =>
      pushTextOf(row, { occurrence, timeZone, now: dependencies.clock.now(), section }),
    buttons: (dispatchId, occurrence) =>
      reminderButtons(dispatchId, {
        recordUrl: recordUrlOf(occurrence),
        openUrl,
      }),
    deepLink: { kind: "task", id: row.id },
    closesForEveryone: true,
    isPressable: true,
    complete: async (presser, occurrence) => {
      const { status } = await dependencies.tasks.complete(presser, { taskId: row.id, occurrence });

      return status === "ok";
    },
    snoozeMs: isTimed ? snoozeMs : daySnoozeMs,
    isSkippedWhenLate: true,
  };
}

type PetOfTask = { name: string; archivedAt: number | null } | undefined;

async function petOfTask(
  { sources }: ReminderDependencies,
  { familyId, petId }: { familyId: string; petId: string | null },
): Promise<PetOfTask> {
  return petId === null ? undefined : sources.pet({ familyId, id: petId });
}

// A Completed single Task and an Archived Pet's Tasks remind of nothing.
function isSilent({ root }: TaskTree, pet: PetOfTask): boolean {
  const { row, completions } = root;

  return (row.frequency === null && completions.length > 0) || (pet?.archivedAt ?? null) !== null;
}

// Each offset of a Task is a source of its own, so «Готово» on one leaves the others; a Pet-linked
// Task offers to record a Care Entry.
export async function taskSources(
  dependencies: ReminderDependencies,
  { familyId, id }: SourceHolder,
): Promise<Source[]> {
  const tree = await dependencies.tasks.findTree(familyId, id);
  const date = tree?.root.row.date ?? null;

  if (tree === undefined || date === null) {
    return [];
  }

  const { row } = tree.root;
  const pet = await petOfTask(dependencies, { familyId, petId: row.petId });

  if (isSilent(tree, pet)) {
    return [];
  }

  const recipientIds = await recipientsOf(dependencies, tree);
  const chatLink = await dependencies.appLinks.chatLink();
  const openUrl = await dependencies.appLinks.appLink({ kind: "task", id: row.id });

  return row.reminderOffsets.map((offset) =>
    taskSource(dependencies, {
      tree,
      date,
      sourcing: { offset, recipientIds, chatLink, openUrl, section: pet?.name ?? "Дела" },
    }),
  );
}
