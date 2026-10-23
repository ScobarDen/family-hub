import type { TileSource } from "@/modules/today";

import type { CareEntryRepo } from "../care-entry.repo.ts";
import { openDueDates } from "../due-date/index.ts";

// The Pets tile names the only Pet in care and carries the most urgent Due Date of all of them.
export function createPetTile({ entries }: { entries: CareEntryRepo }): TileSource<"pet"> {
  return {
    tile: async ({ family }) => {
      const [pets, candidates] = await Promise.all([
        entries.petsOf(family.id),
        entries.allDueCandidates(family.id),
      ]);
      const active = pets.filter(({ archivedAt }) => archivedAt === null);
      const [only, ...others] = active;
      const [urgent] = openDueDates({ pets, entries: candidates });

      return {
        active: active.length,
        only: only === undefined || others.length > 0 ? null : { petId: only.id, name: only.name },
        due: urgent === undefined ? null : { label: urgent.title, date: urgent.dueDate },
      };
    },
  };
}
