import { birthdayFrom, daysAfter, morningOf } from "@family-hub/recurrence";

import type { ReminderSource } from "../reminder.types.ts";
import { reminderButtons, snoozeMs, sourceIdOf } from "./reminder.lib.ts";

type BirthdayPet = { id: string; name: string; birthDate: string };

export function birthdaySource({
  pet,
  recipientIds,
}: {
  pet: BirthdayPet;
  recipientIds: string[];
}): ReminderSource {
  return {
    schedule: {
      kind: "pet_birthday",
      sourceId: sourceIdOf(pet.id),
      recipientIds,
      homeZone: undefined,
      first: (day) => birthdayFrom(pet.birthDate, day),
      next: (occurrence) => birthdayFrom(pet.birthDate, daysAfter(occurrence, 1)),
      fireAt: morningOf,
    },
    kind: {
      emoji: "🎂",
      title: () => `Сегодня день рождения у ${pet.name}!`,
      pushText: () => ({ title: `День рождения: ${pet.name}`, body: "Сегодня" }),
      buttons: (dispatchId) => reminderButtons(dispatchId),
      deepLink: { kind: "pet", id: pet.id },
      closing: { by: "row" },
      snoozeMs,
      content: async () => ({ status: "headline" }),
    },
  };
}
