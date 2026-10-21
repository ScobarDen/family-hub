import { dayAfter, dueStepFrom, firstOccurrenceFrom, morningOf } from "@family-hub/recurrence";

import {
  daySnoozeMs,
  dueButtons,
  formatFloatingDate,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "../reminder.lib.ts";
import type { Owner, ReminderDependencies, Source } from "../reminder.types.ts";
import type { DueEntryRow, PetRow } from "../repo/source.repo.ts";

const dueTitles = {
  vaccination: "Прививка",
  treatment: "Обработка",
  vet_visit: "Визит к ветеринару",
};

// An archived Pet reminds of nothing.
async function activePet({ sources }: ReminderDependencies, owner: Owner) {
  const pet = await sources.pet(owner);

  return pet?.archivedAt === null ? pet : undefined;
}

export async function birthdaySources(
  dependencies: ReminderDependencies,
  owner: Owner,
): Promise<Source[]> {
  const pet = await activePet(dependencies, owner);
  const birthDate = pet?.birthDate ?? null;

  if (pet === undefined || birthDate === null) {
    return [];
  }

  const yearly = { frequency: "yearly" as const, until: null };

  // The day of birth itself is no birthday to congratulate on.
  function from(day: string): string | undefined {
    const occurrence = firstOccurrenceFrom(birthDate ?? day, yearly, day);

    return occurrence === birthDate
      ? firstOccurrenceFrom(birthDate, yearly, dayAfter(birthDate))
      : occurrence;
  }

  return [
    {
      kind: "pet_birthday",
      sourceId: sourceIdOf(pet.id),
      recipientIds: await dependencies.sources.memberIdsOf(pet.familyId),
      homeZone: undefined,
      first: from,
      next: (occurrence) => from(dayAfter(occurrence)),
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

// The newest entry of each due key holds its Due Date; a later one of the same key closes it.
function openDues(entries: DueEntryRow[]): Array<DueEntryRow & { dueDate: string }> {
  const newest = new Map<string, DueEntryRow>();

  for (const entry of entries) {
    if (entry.dueKey !== null && !newest.has(entry.dueKey)) {
      newest.set(entry.dueKey, entry);
    }
  }

  return [...newest.values()].flatMap((entry) =>
    entry.dueDate === null ? [] : [{ ...entry, dueDate: entry.dueDate }],
  );
}

function dueTitleOf({ details }: DueEntryRow): string {
  if (details.kind === "vaccination") {
    return `${dueTitles.vaccination}: ${details.vaccine}`;
  }

  return details.kind === "treatment"
    ? `${dueTitles.treatment}: ${details.target}`
    : dueTitles.vet_visit;
}

type Due = { pet: PetRow; entry: DueEntryRow & { dueDate: string }; recipientIds: string[] };

// A Due Date nudges a week ahead, on the day and then weekly while open, and is never skipped as late.
async function dueSource(
  dependencies: ReminderDependencies,
  { pet, entry, recipientIds }: Due,
): Promise<Source> {
  const recordUrl = await dependencies.appLinks.appLink({ kind: "entry", id: entry.id });
  const title = `${dueTitleOf(entry)} — ${pet.name}`;

  return {
    kind: "pet_due",
    sourceId: sourceIdOf(pet.id, entry.id),
    recipientIds,
    homeZone: undefined,
    first: (day) => dueStepFrom(entry.dueDate, day),
    next: (occurrence) => dueStepFrom(entry.dueDate, dayAfter(occurrence)),
    fireAt: morningOf,
    emoji: "💉",
    title: (occurrence) =>
      occurrence > entry.dueDate
        ? `${title}: просрочено с ${formatFloatingDate(entry.dueDate)}`
        : `${title}: срок ${formatFloatingDate(entry.dueDate)}`,
    buttons: (dispatchId) => dueButtons({ dispatchId, recordUrl }),
    closesForEveryone: false,
    snoozeMs: daySnoozeMs,
    isSkippedWhenLate: false,
  };
}

export async function dueSources(
  dependencies: ReminderDependencies,
  owner: Owner,
): Promise<Source[]> {
  const pet = await activePet(dependencies, owner);

  if (pet === undefined) {
    return [];
  }

  const dues = openDues(await dependencies.sources.dueEntriesOf(owner));
  const recipientIds = await dependencies.sources.memberIdsOf(pet.familyId);

  return Promise.all(
    dues.map(async (entry) => dueSource(dependencies, { pet, entry, recipientIds })),
  );
}
