import {
  action,
  atom,
  computed,
  reatomBoolean,
  withAsyncData,
  wrap,
  type Atom,
} from "@reatom/core";

import type { LiveVersion } from "@/common/live-updates";

import type { AlbumsApi } from "./albums.api.ts";

// Every upload, edit or deletion may change the list, the open Album and «Все фото» at once,
// so they reload together.
export function reatomAlbumsData({
  api,
  openedId,
  liveVersion,
}: {
  api: AlbumsApi;
  openedId: Atom<string | undefined>;
} & LiveVersion) {
  const version = atom(0, "albums.version");
  const isAllShown = reatomBoolean(false, "albums.isAllShown");

  return {
    isAllShown,
    list: computed(async () => {
      version();
      liveVersion?.();

      return wrap(api.list());
    }, "albums.list").extend(withAsyncData()),
    opened: computed(async () => {
      version();
      liveVersion?.();
      const albumId = openedId();

      return albumId === undefined ? undefined : wrap(api.get(albumId));
    }, "albums.opened").extend(withAsyncData()),
    allPhotos: computed(async () => {
      version();
      liveVersion?.();

      return isAllShown() ? wrap(api.allPhotos()) : [];
    }, "albums.allPhotos").extend(withAsyncData()),

    reload: action(() => {
      version.set(version() + 1);
    }, "albums.reload"),
  };
}

export type AlbumsData = ReturnType<typeof reatomAlbumsData>;
