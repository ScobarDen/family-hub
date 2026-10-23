import type { FeedUpcoming } from "@family-hub/contract";
import { occurrenceMoment, occurrencesOnDays, timeInZone } from "@family-hub/recurrence";

import type { UpcomingSource } from "@/modules/feed";

import { sourceIdOf } from "../reminder.lib.ts";
import type { DispatchRepo } from "../repo/dispatch.repo.ts";
import type { ReminderRepo } from "../repo/reminder.repo.ts";

type FeedRepos = { reminders: ReminderRepo; dispatch: DispatchRepo };

// «Готово» in the bot closes an Occurrence on its sent dispatch rows; the next send clears it.
async function doneOccurrences(dispatch: DispatchRepo, familyId: string) {
  const rows = await dispatch.ofFamily(familyId);

  return new Set(
    rows
      .filter((row) => row.source === "reminder" && row.doneAt !== null)
      .map((row) => `${row.sourceId}:${row.sentOccurrence}`),
  );
}

export function createReminderFeed({ reminders, dispatch }: FeedRepos): UpcomingSource {
  return {
    within: async ({ family, member }, { today, last, timeZone }) => {
      const rows = await reminders.visibleRows(family.id, member.id);
      const done = await doneOccurrences(dispatch, family.id);

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
        )
          .filter(({ occurrence }) => !done.has(`${sourceIdOf(row.id)}:${occurrence}`))
          .map(({ occurrence, date, moment }): FeedUpcoming => ({
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
