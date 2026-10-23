import type { TileSource } from "@/modules/today";

import type { CareEntryRepo } from "../care-entry.repo.ts";
import { openDueDates } from "../due-date/index.ts";

// The Pets tile names the only Pet in care, so its Due Date leaves the name out; with several Pets
// the soonest Due Date of them all says whose it is.
export function createPetTile({ entries }: { entries: CareEntryRepo }): TileSource<"pet"> {
  return {
    tile: async ({ family }) => {
      const [pets, candidates] = await Promise.all([
        entries.petsOf(family.id),
        entries.allDueCandidates(family.id),
      ]);
      const active = pets.filter(({ archivedAt }) => archivedAt === null);
      const only = active.length === 1 ? active[0] : undefined;
      const [soonest] = openDueDates({ pets, entries: candidates });

      return {
        activeCount: active.length,
        only: only === undefined ? null : { petId: only.id, name: only.name },
        due:
          soonest === undefined
            ? null
            : { label: only === undefined ? soonest.title : soonest.label, date: soonest.dueDate },
      };
    },
  };
}
