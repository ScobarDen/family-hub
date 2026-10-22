import type { FeedUpcoming } from "@family-hub/contract";
import { birthdaysIn } from "@family-hub/recurrence";

import type { UpcomingSource } from "@/modules/feed";

import type { PetRepo } from "../pet.repo.ts";

// Birthdays of the Pets still in care; Pets are always Shared.
export function createPetFeed({ pets }: { pets: PetRepo }): UpcomingSource {
  return {
    within: async ({ family }, { today, last }) => {
      const rows = await pets.list(family.id);

      return rows.flatMap(({ id, name, birthDate, archivedAt }): FeedUpcoming[] =>
        birthDate === null || archivedAt !== null
          ? []
          : birthdaysIn(birthDate, { from: today, to: last }).map((date) => ({
              kind: "birthday",
              key: `birthday-${id}-${date}`,
              title: `День рождения: ${name}`,
              date,
              petId: id,
            })),
      );
    },
  };
}
