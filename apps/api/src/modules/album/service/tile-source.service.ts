import type { TileSource } from "@/modules/today";

import type { AlbumRepo } from "../album.repo.ts";

export function createAlbumTile({ albums }: { albums: AlbumRepo }): TileSource<"albums"> {
  return {
    tile: async ({ family }) => ({ photos: await albums.countPhotos(family.id) }),
  };
}
