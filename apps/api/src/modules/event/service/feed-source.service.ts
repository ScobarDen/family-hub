import type { FeedUpcoming } from "@family-hub/contract";
import { occurrenceMoment, occurrencesOnDays, timeInZone } from "@family-hub/recurrence";

import type { UpcomingSource } from "@/modules/feed";

import type { EventRepo } from "../event.repo.ts";

export function createEventFeed({ events }: { events: EventRepo }): UpcomingSource {
  return {
    within: async ({ family, member }, { today, last, timeZone }) => {
      const rows = await events.listVisible(family.id, member.id);

      return rows.flatMap((row) => {
        const { startTime: time, timeZone: zone } = row;

        return occurrencesOnDays(
          {
            startDate: row.startDate,
            recurrence:
              row.frequency === null ? null : { frequency: row.frequency, until: row.until },
            skipped: row.skippedDates,
          },
          {
            days: { from: today, to: last, timeZone },
            momentOf: (occurrence) =>
              time === null || zone === null
                ? undefined
                : occurrenceMoment(occurrence, { time, timeZone: zone }),
          },
        ).map(({ occurrence, date, moment }): FeedUpcoming => ({
          kind: "event",
          key: `event-${row.id}-${occurrence}`,
          title: row.title,
          date,
          time: moment === undefined ? null : timeInZone(moment, timeZone),
          eventId: row.id,
        }));
      });
    },
  };
}
