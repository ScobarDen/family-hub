import type { Today } from "@family-hub/contract";
import { dateInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { fallbackTimeZone, type Clock } from "@/common/clock";
import type { FeedService } from "@/modules/feed";

import type { TileSources, TileWindow } from "./today.types.ts";

type TodayDependencies = { feed: Pick<FeedService, "todayOf">; tiles: TileSources; clock: Clock };

async function tilesOf(tiles: TileSources, viewer: Membership, window: TileWindow) {
  const [plans, calendar, pet, goals, albums, recipes] = await Promise.all([
    tiles.plans.tile(viewer, window),
    tiles.calendar.tile(viewer, window),
    tiles.pet.tile(viewer, window),
    tiles.goals.tile(viewer, window),
    tiles.albums.tile(viewer, window),
    tiles.recipes.tile(viewer, window),
  ]);

  return { plans, calendar, pet, goals, albums, recipes };
}

export function createTodayService({ feed, tiles, clock }: TodayDependencies) {
  return {
    async of(viewer: Membership): Promise<Today> {
      const timeZone = viewer.member.timeZone ?? fallbackTimeZone;
      const window = { today: dateInZone(clock.now(), timeZone), timeZone };
      const [agenda, sectionTiles] = await Promise.all([
        feed.todayOf(viewer),
        tilesOf(tiles, viewer, window),
      ]);

      return { ...agenda, tiles: sectionTiles };
    },
  };
}

export type TodayService = ReturnType<typeof createTodayService>;
