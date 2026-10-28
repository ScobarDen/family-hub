import {
  action,
  atom,
  computed,
  reatomBoolean,
  withAsyncData,
  withRollback,
  wrap,
  type Atom,
} from "@reatom/core";

import { albumList } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { LiveVersion } from "@/common/live-updates";
import { rolledBackById } from "@/common/records";

import type { AlbumsApi } from "./albums.api.ts";

// Every upload, edit or deletion may change the list, the open Album and «Все фото» at once,
// so they reload together.
export function reatomAlbumsData({
  api,
  openedId,
  liveVersion,
  deviceCache,
}: {
  api: AlbumsApi;
  openedId: Atom<string | undefined>;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
} & LiveVersion) {
  const version = atom(0, "albums.version");
  const isAllShown = reatomBoolean(false, "albums.isAllShown");
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list());
  }, "albums.list").extend(withAsyncData());

  list.data.extend(
    deviceCache.withDeviceCache({ key: "albums", schema: albumList, version: 1 }),
    withRollback({ onRollback: rolledBackById }),
  );

  return {
    isAllShown,
    list,
    opened: computed(async () => {
      version();
      liveVersion?.();
      const albumId = openedId();

      return albumId === undefined ? undefined : wrap(api.get(albumId));
    }, "albums.opened").extend(withAsyncData()),
    allPhotos: computed(async () => {
      version();
      liveVersion?.();

      return isAllShown() ? wrap(api.allPhotos()) : undefined;
    }, "albums.allPhotos").extend(withAsyncData()),

    reload: action(() => {
      version.set(version() + 1);
    }, "albums.reload"),
  };
}

export type AlbumsData = ReturnType<typeof reatomAlbumsData>;
