import { action, computed } from "@reatom/core";

import { petList, type Pet } from "@family-hub/contract";

import { upserted, withoutId } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import { reatomLiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";

import type { PetsApi } from "./pets.api.ts";

type PetsDependencies = LiveVersion & {
  api: PetsApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
};

function reatomList({ api, liveVersion, deviceCache }: PetsDependencies) {
  return reatomLiveResource({
    name: "pets.list",
    liveVersion,
    load: async () => api.list(),
    cache: {
      withDeviceCache: deviceCache.withDeviceCache,
      key: "pets",
      schema: petList,
      version: 1,
    },
  });
}

export function reatomPets(dependencies: PetsDependencies) {
  const list = reatomList(dependencies);
  const active = computed(
    () => (list.data() ?? []).filter((pet) => pet.archivedAt === null),
    "pets.active",
  );

  return {
    list,
    reload: list.reload,
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
      list.change((pets) => upserted(pets ?? [], saved));
    }, "pets.keep"),
    drop: action((petId: string) => {
      list.change((pets) => withoutId(pets ?? [], petId));
    }, "pets.drop"),
  };
}

export type PetsModel = ReturnType<typeof reatomPets>;
