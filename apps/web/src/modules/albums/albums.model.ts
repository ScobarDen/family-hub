import { action, reatomBoolean, type Atom } from "@reatom/core";

import { albumList } from "@family-hub/contract";

import { rolledBackById } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import { reatomLiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";

import type { AlbumsApi } from "./albums.api.ts";

type AlbumsDataDependencies = {
  api: AlbumsApi;
  openedId: Atom<string | undefined>;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
} & LiveVersion;

function reatomShownAlbums({ api, openedId, liveVersion }: AlbumsDataDependencies) {
  const isAllShown = reatomBoolean(false, "albums.isAllShown");

  return {
    isAllShown,
    opened: reatomLiveResource({
      name: "albums.opened",
      liveVersion,
      load: async () => {
        const albumId = openedId();

        return albumId === undefined ? undefined : api.get(albumId);
      },
    }),
    allPhotos: reatomLiveResource({
      name: "albums.allPhotos",
      liveVersion,
      load: async () => (isAllShown() ? api.allPhotos() : undefined),
    }),
  };
}

// Every upload, edit or deletion may change the list, the open Album and «Все фото» at once,
// so they reload together.
export function reatomAlbumsData(dependencies: AlbumsDataDependencies) {
  const { api, liveVersion, deviceCache } = dependencies;
  const list = reatomLiveResource({
    name: "albums.list",
    liveVersion,
    load: async () => api.list(),
    cache: {
      withDeviceCache: deviceCache.withDeviceCache,
      key: "albums",
      schema: albumList,
      version: 1,
    },
    rollback: rolledBackById,
  });
  const shown = reatomShownAlbums(dependencies);

  return {
    ...shown,
    list,
    reload: action(() => {
      list.reload();
      shown.opened.reload();
      shown.allPhotos.reload();
    }, "albums.reload"),
  };
}

export type AlbumsData = ReturnType<typeof reatomAlbumsData>;
