import type { CompletedOccurrence, ReopenedOccurrence } from "@/modules/task";
import { ignoringBotErrors } from "@/modules/telegram";

import { doneText } from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { fireAfter, sourceChanged, zoneOf } from "./schedule.service.ts";
import { kindsOf } from "./source.service.ts";
import { taskSourcesToClose } from "./task-source.service.ts";

type Closed = {
  occurrence: string | null;
  by: { id: string; name: string };
  sourceOf: (row: DispatchRow) => Source | undefined;
};

type Closing = ReminderDependencies & Omit<Closed, "sourceOf"> & { now: number };

async function closeMessage(
  closing: Closing,
  { row, source }: { row: DispatchRow; source: Source },
) {
  const { dispatch, bot, by, now, occurrence } = closing;

  if (row.chatId !== null && row.messageId !== null) {
    await ignoringBotErrors(
      bot.call("editMessageText", {
        chat_id: row.chatId,
        message_id: row.messageId,
        text: doneText({
          text: source.title(
            occurrence ?? "",
            await zoneOf(closing, { memberId: row.memberId, source }),
          ),
          doneBy: by.name,
        }),
      }),
    );
  }

  await dispatch.update(row.familyId, row.id, { doneAt: now, doneBy: by.id, updatedAt: now });
}

async function moveOn(closing: Closing, { row, source }: { row: DispatchRow; source: Source }) {
  const { dispatch, occurrence, now } = closing;
  const next =
    occurrence === null
      ? undefined
      : fireAfter(source, {
          occurrence,
          timeZone: await zoneOf(closing, { memberId: row.memberId, source }),
        });

  await dispatch.update(row.familyId, row.id, {
    occurrence: next?.occurrence ?? null,
    nextFireAt: next?.fireAt ?? null,
    updatedAt: now,
  });
}

async function closeRow(closing: Closing, { row, source }: { row: DispatchRow; source: Source }) {
  if (row.sentOccurrence === closing.occurrence && row.doneAt === null) {
    await closeMessage(closing, { row, source });
  }

  if (closing.occurrence !== null && row.occurrence === closing.occurrence) {
    await moveOn(closing, { row, source });
  }
}

// A closed Occurrence is closed for every Recipient: sent messages turn into «Сделал(а) …», once,
// and rows still waiting for it move on.
export async function closeOccurrence(
  dependencies: ReminderDependencies,
  { rows, sourceOf, ...closed }: Closed & { rows: DispatchRow[] },
): Promise<void> {
  const closing: Closing = { ...dependencies, ...closed, now: dependencies.clock.now() };

  for (const row of rows) {
    const source = sourceOf(row);

    if (source !== undefined) {
      await closeRow(closing, { row, source });
    }
  }
}

function rowsOfTask(dependencies: ReminderDependencies, familyId: string, taskId: string) {
  return dependencies.dispatch.ofHolder({ familyId, sources: kindsOf("task"), holderId: taskId });
}

// Every offset of the Task closes with it; its rows are read before rescheduling, which drops
// them once a single Task is Completed.
export async function occurrenceCompleted(
  dependencies: ReminderDependencies,
  familyId: string,
  { taskId, occurrence, by }: CompletedOccurrence,
): Promise<void> {
  const sources = await taskSourcesToClose(dependencies, { familyId, id: taskId });

  await closeOccurrence(dependencies, {
    rows: await rowsOfTask(dependencies, familyId, taskId),
    occurrence,
    by,
    sourceOf: (row) => sources.find(({ sourceId }) => sourceId === row.sourceId),
  });
  await sourceChanged(dependencies, { familyId, kind: "task", id: taskId });
}

// The messages already rewritten stay as they are; only the mark that refuses a press goes.
export async function occurrenceReopened(
  dependencies: ReminderDependencies,
  familyId: string,
  { taskId, occurrence }: ReopenedOccurrence,
): Promise<void> {
  const now = dependencies.clock.now();

  for (const row of await rowsOfTask(dependencies, familyId, taskId)) {
    if (row.sentOccurrence === occurrence && row.doneAt !== null) {
      await dependencies.dispatch.update(familyId, row.id, {
        doneAt: null,
        doneBy: null,
        updatedAt: now,
      });
    }
  }

  await sourceChanged(dependencies, { familyId, kind: "task", id: taskId });
}
