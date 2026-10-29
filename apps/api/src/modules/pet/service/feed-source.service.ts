import type { FeedUpcoming } from "@family-hub/contract";
import { birthdaysIn } from "@family-hub/recurrence";

import type { PhotoLinks } from "@/common/photo-link.lib.ts";
import type { UpcomingSource } from "@/modules/feed";

import type { PetRepo } from "../pet.repo.ts";

// Birthdays of the Pets still in care; Pets are always Shared.
export function createPetFeed({
  pets,
  links,
}: {
  pets: PetRepo;
  links: PhotoLinks;
}): UpcomingSource {
  return {
    within: async ({ family }, { today, last }) => {
      const rows = await pets.list(family.id);
      const birthdays = await Promise.all(
        rows.map(
          async ({ id, name, birthDate, archivedAt, avatarPhotoId }): Promise<FeedUpcoming[]> => {
            const dates =
              birthDate === null || archivedAt !== null
                ? []
                : birthdaysIn(birthDate, { from: today, to: last });
            const petPicture = dates.length === 0 ? null : await links.thumbOf(avatarPhotoId);

            return dates.map((date) => ({
              kind: "birthday",
              key: `birthday-${id}-${date}`,
              title: `День рождения: ${name}`,
              date,
              petId: id,
              petPicture,
            }));
          },
        ),
      );

      return birthdays.flat();
    },
  };
}
