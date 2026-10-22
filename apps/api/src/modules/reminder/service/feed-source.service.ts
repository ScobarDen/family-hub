import type { FeedUpcoming } from "@family-hub/contract";
import { occurrenceMoment, occurrencesOnDays, timeInZone } from "@family-hub/recurrence";

import type { UpcomingSource } from "@/modules/feed";

import type { ReminderRepo } from "../repo/reminder.repo.ts";

export function createReminderFeed({ reminders }: { reminders: ReminderRepo }): UpcomingSource {
  return {
    within: async ({ family, member }, { today, last, timeZone }) => {
      const rows = await reminders.visibleRows(family.id, member.id);

      return rows.flatMap((row) =>
        occurrencesOnDays(
          {
            startDate: row.startDate,
            recurrence:
              row.frequency === null ? null : { frequency: row.frequency, until: row.until },
          },
          {
            days: { from: today, to: last, timeZone },
            momentOf: (occurrence) =>
              occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone }),
          },
        ).map(({ occurrence, date, moment }): FeedUpcoming => ({
          kind: "reminder",
          key: `reminder-${row.id}-${occurrence}`,
          title: row.text,
          date,
          time: timeInZone(moment, timeZone),
          reminderId: row.id,
        })),
      );
    },
  };
}
