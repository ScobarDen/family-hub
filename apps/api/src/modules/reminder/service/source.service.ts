import { eventReminderOffset } from "@family-hub/contract";

import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { eventSource, reminderSource } from "./calendar-source.service.ts";
import { birthdaySource, dueSource, openDues } from "./pet-source.service.ts";
import { planOf } from "./plan-source.service.ts";

async function reminderOf({ reminders }: ReminderDependencies, reminderId: string) {
  const entry = await reminders.findById(reminderId);

  return (
    entry &&
    reminderSource(
      entry.reminder,
      entry.recipients.map(({ id }) => id),
    )
  );
}

// An offset dropped from the Event, or the Event deleted, leaves its rows with no source.
async function eventOf(dependencies: ReminderDependencies, sourceId: string) {
  const [eventId = "", rawOffset] = sourceId.split(":");
  const offset = eventReminderOffset.safeParse(rawOffset);
  const row = await dependencies.sources.event(eventId);

  return row !== undefined && offset.success && row.reminderOffsets.includes(offset.data)
    ? eventSource(dependencies, { row, offset: offset.data })
    : undefined;
}

async function birthdayOf(dependencies: ReminderDependencies, petId: string) {
  const pet = await dependencies.sources.pet(petId);

  return pet && birthdaySource(dependencies, pet);
}

async function dueOf(
  dependencies: ReminderDependencies,
  sourceId: string,
): Promise<Source | undefined> {
  const [petId = "", entryId] = sourceId.split(":");
  const pet = await dependencies.sources.pet(petId);

  if (pet === undefined || pet.archivedAt !== null) {
    return undefined;
  }

  const entry = openDues(await dependencies.sources.dueEntriesOf(petId)).find(
    ({ id }) => id === entryId,
  );

  return entry && dueSource(dependencies, { pet, entry });
}

export async function sourceOfRow(
  dependencies: ReminderDependencies,
  { source, sourceId }: Pick<DispatchRow, "source" | "sourceId">,
): Promise<Source | undefined> {
  if (source === "reminder") {
    return reminderOf(dependencies, sourceId);
  }

  if (source === "event") {
    return eventOf(dependencies, sourceId);
  }

  if (source === "plan") {
    return planOf(dependencies, sourceId);
  }

  return source === "pet_birthday"
    ? birthdayOf(dependencies, sourceId)
    : dueOf(dependencies, sourceId);
}

export async function eventSources(
  dependencies: ReminderDependencies,
  eventId: string,
): Promise<Source[]> {
  const row = await dependencies.sources.event(eventId);

  return row === undefined
    ? []
    : Promise.all(
        row.reminderOffsets.map(async (offset) => eventSource(dependencies, { row, offset })),
      );
}

export async function dueSources(
  dependencies: ReminderDependencies,
  petId: string,
): Promise<Source[]> {
  const pet = await dependencies.sources.pet(petId);

  if (pet === undefined || pet.archivedAt !== null) {
    return [];
  }

  const dues = openDues(await dependencies.sources.dueEntriesOf(petId));

  return Promise.all(dues.map(async (entry) => dueSource(dependencies, { pet, entry })));
}

export { birthdayOf };
