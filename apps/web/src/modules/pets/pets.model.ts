import { action, computed, withAsyncData, wrap } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import { upserted, withoutId } from "@/common/records";

import type { PetsApi } from "./pets.api.ts";

export function reatomPets({ api }: { api: PetsApi }) {
  const list = computed(async () => wrap(api.list()), "pets.list").extend(withAsyncData());
  const active = computed(
    () => (list.data() ?? []).filter((pet) => pet.archivedAt === null),
    "pets.active",
  );

  return {
    list,
    active,
    archived: computed(
      () => (list.data() ?? []).filter((pet) => pet.archivedAt !== null),
      "pets.archived",
    ),

    // A single Pet names the tab; several share «Питомцы»; none keeps the module's own title.
    tabTitle: computed((): string | undefined => {
      const [first, ...others] = active();

      if (first === undefined) {
        return undefined;
      }

      return others.length === 0 ? first.name : "Питомцы";
    }, "pets.tabTitle"),

    keep: action((saved: Pet) => {
      list.data.set(upserted(list.data() ?? [], saved));
    }, "pets.keep"),
    drop: action((petId: string) => {
      list.data.set(withoutId(list.data() ?? [], petId));
    }, "pets.drop"),
  };
}

export type PetsModel = ReturnType<typeof reatomPets>;
