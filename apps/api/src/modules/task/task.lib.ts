import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type {
  Completion,
  ParsedTaskChange,
  Person,
  Recurrence,
  Subtask,
  Task,
  TaskAlbum,
  TaskWhen,
} from "@family-hub/contract";
import { firstOccurrenceFrom } from "@family-hub/recurrence";

import type { RecipientsMode } from "@/common/db";

import type { CompletionRow, PersonRow, TaskRecord, TaskRow, TaskTree } from "./task.repo.ts";

// A Task without a Recurrence has one Occurrence, stored as "", so moving its date keeps it done.
export function occurrenceKey(row: TaskRow, occurrence: string | null): string {
  return row.frequency === null ? "" : (occurrence ?? "");
}

// Any date stands for the one Occurrence of a Task without a Recurrence.
export function isOccurrenceOf(row: TaskRow, date: string | null): boolean {
  if (row.frequency === null) {
    return true;
  }

  return (
    row.date !== null &&
    date !== null &&
    firstOccurrenceFrom(row.date, recurrenceOf(row), date) === date
  );
}

export function isCompleted(record: TaskRecord, occurrence: string | null): boolean {
  const key = occurrenceKey(record.row, occurrence);

  return record.completions.some((completion) => completion.occurrence === key);
}

// The one Overdue rule the Feed, Today and the digest share: a past Occurrence of a Task with
// Assignees that is neither Completed nor skipped.
// `date` is the viewer's day the Occurrence falls on, which a timed one in another zone may shift.
export function isOverdue(
  record: TaskRecord,
  { occurrence, date, today }: { occurrence: string; date: string; today: string },
): boolean {
  return date < today && record.assignees.length > 0 && !isCompleted(record, occurrence);
}

export function whenOf(row: TaskRow): TaskWhen | null {
  return row.date === null
    ? null
    : {
        date: row.date,
        time: row.time,
        timeZone: row.timeZone,
        endDate: row.endDate,
        endTime: row.endTime,
      };
}

export function recurrenceOf(row: TaskRow): Recurrence | null {
  return row.frequency === null ? null : { frequency: row.frequency, until: row.until };
}

function personOf({ id, name, profilePicture }: PersonRow): Person {
  return { id, name, profilePicture };
}

function completionOf({ at, by }: CompletionRow): Completion {
  return { at, by };
}

function toSubtask({ row, assignees, completions }: TaskRecord): Subtask {
  const [completion] = completions;

  return {
    id: row.id,
    title: row.title,
    date: row.date,
    assignees: assignees.map(personOf),
    completed: completion === undefined ? null : completionOf(completion),
  };
}

type Viewing = {
  memberId: string;
  album: TaskAlbum | null;
  pet: Task["pet"];
};

export function toTask({ root, subtasks }: TaskTree, { memberId, album, pet }: Viewing): Task {
  const { row } = root;

  return {
    id: row.id,
    title: row.title,
    note: row.note,
    when: whenOf(row),
    recurrence: recurrenceOf(row),
    skippedDates: row.skippedDates,
    assignees: root.assignees.map(personOf),
    recipients:
      row.recipientsMode === "members" ? root.recipients.map(personOf) : row.recipientsMode,
    reminderOffsets: row.reminderOffsets,
    visibility: row.visibility ?? "shared",
    isOwn: row.ownerMemberId === memberId,
    pet,
    album,
    completions: root.completions.map((completion) => ({
      ...completionOf(completion),
      occurrence: completion.occurrence === "" ? null : completion.occurrence,
    })),
    subtasks: subtasks.map(toSubtask),
  };
}

export function recipientsModeOf({ recipients }: ParsedTaskChange): RecipientsMode {
  return Array.isArray(recipients) ? "members" : recipients;
}

const noWhen = { date: null, time: null, timeZone: null, endDate: null, endTime: null };

export function columnsOf(change: ParsedTaskChange) {
  const { when, recurrence } = change;

  return {
    title: change.title,
    note: change.note,
    ...(when ?? noWhen),
    ...(recurrence ?? { frequency: null, until: null }),
    reminderOffsets: change.reminderOffsets,
    recipientsMode: recipientsModeOf(change),
    visibility: change.visibility,
    petId: change.petId,
    albumId: change.albumId,
  };
}

export function isAllDone(subtasks: TaskRecord[]): boolean {
  return subtasks.length > 0 && subtasks.every(({ completions }) => completions.length > 0);
}

export function titleOf(step: { title: string }, root: { title: string } | null): string {
  return root === null ? step.title : `${root.title}: ${step.title}`;
}

const dayAndMonth = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// A date is a floating calendar day, so it is shown as that day in UTC, not in a zone.
function formatDate(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);

  return dayAndMonth.format(Date.UTC(year, month - 1, day));
}

type AssignedText = { assignerName: string; title: string; date: string | null };

export function assignedText({ assignerName, title, date }: AssignedText): string {
  const due = date === null ? "" : ` · ${formatDate(date)}`;

  return `🧑 ${assignerName} назначил(а) тебе: ${title}${due}`;
}

export function openTaskButton(url: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "Открыть", url }]] };
}
