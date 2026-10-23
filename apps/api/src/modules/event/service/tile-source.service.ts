import { todayWeekDays } from "@family-hub/contract";
import { daysAfter } from "@family-hub/recurrence";

import type { TileSource } from "@/modules/today";

import type { EventRepo } from "../event.repo.ts";
import { createEventFeed } from "./feed-source.service.ts";

export function createEventTile({ events }: { events: EventRepo }): TileSource<"calendar"> {
  const feed = createEventFeed({ events });

  return {
    tile: async (viewer, { today, timeZone }) => {
      const week = await feed.within(viewer, {
        today,
        last: daysAfter(today, todayWeekDays - 1),
        timeZone,
      });

      return { events: week.length };
    },
  };
}
