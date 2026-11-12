import { birthdaySource } from "../lib/birthday-kind.lib.ts";
import type { ReminderDependencies, ReminderSource, SourceHolder } from "../reminder.types.ts";

export async function birthdaySources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<ReminderSource[]> {
  const pet = await dependencies.sources.pet(holder);
  const birthDate = pet?.birthDate ?? null;

  if (pet === undefined || pet.archivedAt !== null || birthDate === null) {
    return [];
  }

  return [
    birthdaySource({
      pet: { id: pet.id, name: pet.name, birthDate },
      recipientIds: await dependencies.sources.memberIdsOf(pet.familyId),
    }),
  ];
}
