import { todayWeekDays } from "@family-hub/contract";

import type { TileSource } from "@/modules/today";

import type { AlbumRepo } from "../album.repo.ts";

const dayMs = 86_400_000;

export function createAlbumTile({ albums }: { albums: AlbumRepo }): TileSource<"albums"> {
  return {
    tile: async ({ family }, { now }) => ({
      photos: await albums.countPhotosSince(family.id, now - todayWeekDays * dayMs),
    }),
  };
}
