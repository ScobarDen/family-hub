import type { Today, TodayTiles } from "@family-hub/contract";
import { dateInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { fallbackTimeZone, type Clock } from "@/common/clock";
import type { FeedService } from "@/modules/feed";

import type { TileSource, TileSources, TileWindow } from "./today.types.ts";

type TodayDependencies = { feed: Pick<FeedService, "todayOf">; tiles: TileSources; clock: Clock };

type Section = keyof TodayTiles;

// The hub is the first screen, so one section that cannot be read shows as a bare tile.
async function tileOf<Name extends Section>(
  section: Name,
  source: TileSource<Name>,
  { viewer, window }: { viewer: Membership; window: TileWindow },
): Promise<TodayTiles[Name] | null> {
  try {
    return await source.tile(viewer, window);
  } catch (error) {
    console.error("Today tile not read", { section, error });

    return null;
  }
}

async function tilesOf(tiles: TileSources, reading: { viewer: Membership; window: TileWindow }) {
  const [tasks, pet, goals, albums, recipes] = await Promise.all([
    tileOf("tasks", tiles.tasks, reading),
    tileOf("pet", tiles.pet, reading),
    tileOf("goals", tiles.goals, reading),
    tileOf("albums", tiles.albums, reading),
    tileOf("recipes", tiles.recipes, reading),
  ]);

  return { tasks, pet, goals, albums, recipes };
}

export function createTodayService({ feed, tiles, clock }: TodayDependencies) {
  return {
    async of(viewer: Membership): Promise<Today> {
      const timeZone = viewer.member.timeZone ?? fallbackTimeZone;
      const window = { today: dateInZone(clock.now(), timeZone), timeZone };
      const [dueAndNext, sectionTiles] = await Promise.all([
        feed.todayOf(viewer),
        tilesOf(tiles, { viewer, window }),
      ]);

      return { ...dueAndNext, tiles: sectionTiles };
    },
  };
}

export type TodayService = ReturnType<typeof createTodayService>;
