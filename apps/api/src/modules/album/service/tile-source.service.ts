import { tileWindowDays } from "@family-hub/contract";
import { daysAfter, occurrenceMoment } from "@family-hub/recurrence";

import type { TileSource } from "@/modules/today";

import type { AlbumRepo } from "../album.repo.ts";

// The last seven days are today and the six before it, from midnight on the viewer's clock.
export function createAlbumTile({ albums }: { albums: AlbumRepo }): TileSource<"albums"> {
  return {
    tile: async ({ family }, { today, timeZone }) => {
      const since = occurrenceMoment(daysAfter(today, 1 - tileWindowDays), {
        time: "00:00",
        timeZone,
      });

      return { photos: await albums.countPhotosSince(family.id, since) };
    },
  };
}
