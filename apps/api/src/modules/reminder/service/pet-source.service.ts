import { birthdayFrom, daysAfter, morningOf } from "@family-hub/recurrence";

import { reminderButtons, snoozeMs, sourceIdOf } from "../reminder.lib.ts";
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
      pushOf: () => ({ title: `День рождения: ${pet.name}`, body: "Сегодня" }),
      buttons: (dispatchId) => reminderButtons(dispatchId),
      deepLink: { kind: "pet", id: pet.id },
      closesForEveryone: true,
      isPressable: true,
      snoozeMs,
      isSkippedWhenLate: true,
    },
  ];
}
