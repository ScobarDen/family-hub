import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import { petList, type Pet } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { LiveVersion } from "@/common/live-updates";
import { upserted, withoutId } from "@/common/records";

import type { PetsApi } from "./pets.api.ts";

type PetsDependencies = LiveVersion & {
  api: PetsApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
};

function reatomList({ api, liveVersion, deviceCache }: PetsDependencies) {
  const version = atom(0, "pets.version");
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list());
  }, "pets.list").extend(withAsyncData());

  list.data.extend(deviceCache.withDeviceCache({ key: "pets", schema: petList, version: 1 }));

  return {
    list,
    reload: action(() => {
      version.set(version() + 1);
    }, "pets.reload"),
  };
}

export function reatomPets(dependencies: PetsDependencies) {
  const { list, reload } = reatomList(dependencies);
  const active = computed(
    () => (list.data() ?? []).filter((pet) => pet.archivedAt === null),
    "pets.active",
  );

  return {
    list,
    reload,
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
