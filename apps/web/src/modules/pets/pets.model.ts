import { action, computed, withAsyncData, wrap } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

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

    // A single Pet names the tab; several share «Питомцы»; none keeps the module's own title.
    tabTitle: computed((): string | undefined => {
      const [first, ...others] = active();

      if (first === undefined) {
        return undefined;
      }

      return others.length === 0 ? first.name : "Питомцы";
    }, "pets.tabTitle"),

    keep: action((saved: Pet) => {
      const current = list.data() ?? [];

      list.data.set(
        current.some((pet) => pet.id === saved.id)
          ? current.map((pet) => (pet.id === saved.id ? saved : pet))
          : [...current, saved],
      );
    }, "pets.keep"),
  };
}

export type PetsModel = ReturnType<typeof reatomPets>;
