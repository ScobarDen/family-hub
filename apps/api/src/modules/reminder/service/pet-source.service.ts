import { birthdayFrom, daysAfter, dueStepFrom, morningOf } from "@family-hub/recurrence";

import { openDueDates, type OpenDueDate } from "@/modules/care-entry";

import {
  daySnoozeMs,
  dueButtons,
  formatFloatingDate,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "../reminder.lib.ts";
import type { SourceHolder, ReminderDependencies, Source } from "../reminder.types.ts";

export async function birthdaySources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<Source[]> {
  const pet = await dependencies.sources.pet(holder);
  const birthDate = pet?.birthDate ?? null;

  if (pet === undefined || pet.archivedAt !== null || birthDate === null) {
    return [];
  }

  return [
    {
      kind: "pet_birthday",
      sourceId: sourceIdOf(pet.id),
      recipientIds: await dependencies.sources.memberIdsOf(pet.familyId),
      homeZone: undefined,
      first: (day) => birthdayFrom(birthDate, day),
      next: (occurrence) => birthdayFrom(birthDate, daysAfter(occurrence, 1)),
      fireAt: morningOf,
      emoji: "🎂",
      title: () => `Сегодня день рождения у ${pet.name}!`,
      buttons: reminderButtons,
      closesForEveryone: true,
      snoozeMs,
      isSkippedWhenLate: true,
    },
  ];
}

// A Due Date nudges a week ahead, on the day and then weekly while open, and is never skipped as late.
async function dueSource(
  dependencies: ReminderDependencies,
  { due, recipientIds }: { due: OpenDueDate; recipientIds: string[] },
): Promise<Source> {
  const { dueDate, title } = due;
  const recordUrl = await dependencies.appLinks.appLink({ kind: "entry", id: due.entryId });

  return {
    kind: "pet_due",
    sourceId: sourceIdOf(due.petId, due.entryId),
    recipientIds,
    homeZone: undefined,
    first: (day) => dueStepFrom(dueDate, day),
    next: (occurrence) => dueStepFrom(dueDate, daysAfter(occurrence, 1)),
    fireAt: morningOf,
    emoji: "💉",
    title: (occurrence) =>
      occurrence > dueDate
        ? `${title}: просрочено с ${formatFloatingDate(dueDate)}`
        : `${title}: срок ${formatFloatingDate(dueDate)}`,
    buttons: (dispatchId) => dueButtons({ dispatchId, recordUrl }),
    closesForEveryone: false,
    snoozeMs: daySnoozeMs,
    isSkippedWhenLate: false,
  };
}

export async function dueSources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<Source[]> {
  const pet = await dependencies.sources.pet(holder);

  if (pet === undefined) {
    return [];
  }

  const dues = openDueDates({
    pets: [pet],
    entries: await dependencies.sources.dueEntriesOf(holder),
  });
  const recipientIds = await dependencies.sources.memberIdsOf(pet.familyId);

  return Promise.all(dues.map(async (due) => dueSource(dependencies, { due, recipientIds })));
}
