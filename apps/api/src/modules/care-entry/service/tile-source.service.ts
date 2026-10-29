import type { PhotoLinks } from "@/modules/photo";
import type { TileSource } from "@/modules/today";

import type { CareEntryRepo } from "../care-entry.repo.ts";

// The Pets tile names the only Pet in care; what is due for a Pet is in its Tasks.
export function createPetTile({
  entries,
  links,
}: {
  entries: CareEntryRepo;
  links: PhotoLinks;
}): TileSource<"pet"> {
  return {
    tile: async ({ family }) => {
      const pets = await entries.petsOf(family.id);
      const active = pets.filter(({ archivedAt }) => archivedAt === null);
      const only = active.length === 1 ? active[0] : undefined;

      return {
        activeCount: active.length,
        only:
          only === undefined
            ? null
            : {
                petId: only.id,
                name: only.name,
                picture: await links.thumbOf(only.avatarPhotoId),
                birthDate: only.birthDate,
              },
      };
    },
  };
}
