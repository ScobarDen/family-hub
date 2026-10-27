---
name: temporal-dates
description: Dates and times in Family Hub with Temporal (`temporal-polyfill`) — floating dates versus moments in a zone, Task Recurrence and Occurrences, Reminder fire times per Recipient, storage formats and `packages/recurrence`. Load when code computes, stores, compares or formats a date, a time or a time zone.
---

# Dates and times

All date math runs on Temporal from `temporal-polyfill` (`import { Temporal } from "temporal-polyfill"`), the same in the Mini App, the Worker and tests. `Date` appears only at the edges that hand out epoch milliseconds: the `Clock` in `apps/api/src/common/clock` and Drizzle rows.

## Two kinds of time

Every value is one of these; decide which before writing code.

| Kind | Temporal type | Stored as | Examples |
| --- | --- | --- | --- |
| **Floating date** — the same calendar day in every zone | `Temporal.PlainDate` | `TEXT` `YYYY-MM-DD` | the date of a Task without a time, a Task Occurrence, Pet birthday, Savings Goal deadline, Contribution day |
| **Moment** — one instant, entered in its creator's zone | `Temporal.ZonedDateTime` in code, `Temporal.Instant` at rest | `INTEGER` epoch ms UTC + `TEXT` IANA zone of the creator | a Task with a time, `next_fire_at`, a Task completion's `completed_at`, every `created_at` / `updated_at` |

- A moment keeps its creator's zone next to it because Recurrence is computed in that zone: a weekly 19:00 stays 19:00 across a DST change.
- A Member sees moments in their own zone, taken from the device and editable in settings.
- Converting a floating date to a moment needs an explicit zone and time of day; there is no implicit "local".

## Rules the product fixed

- **A Task's date is optional.** Without a date it has no Occurrences, no Recurrence and no Reminders. With a date it has one Occurrence, or one per step of its Recurrence; a time makes each Occurrence a moment in the zone the Task was set in.
- **Recurrence** is weekly, monthly or yearly with an optional end date, no "every N". It is evaluated in the creator's zone. A monthly series on the 31st falls on the last day of shorter months. Edits apply to the whole series; single Occurrences are skipped through `skipped_dates`.
- **Occurrences and Pet birthdays are computed, never stored.** The stored inputs are the Task's date and rule, `skipped_dates` and the Pet's `birth_date`. What is stored per Occurrence is only its completion (Task id + Occurrence date + who + when).
- **Overdue**: an Occurrence of a Task with at least one Assignee whose date has passed on the viewer's clock while it is neither Completed nor skipped. A Task without Assignees never becomes Overdue. A recurring Task is looked back on for a limited number of days only (`overdueLookbackDays` in the contract), so a forgotten weekly chore does not pile up forever.
- **Reminder offsets** are one set for every Task: at the moment, 15 min, 1 h, 1 day, 1 week before; up to three. `15m` and `1h` need a time.
- **Fire time depends on the Recipient** for a Task without a time: «at the moment» is 09:00 on that day in each Recipient's zone, «1 day» and «1 week» are 09:00 that many days before. A timed Task fires its offset before the Occurrence's moment, the same instant for every Recipient. Pet birthdays nudge at 09:00 in each Recipient's zone.
- **Snooze** is an hour for a timed Task and a day for a Task without a time.
- **Lateness**: more than 12 hours late, a Reminder moves silently to its next Occurrence.

## Where the math lives

- `packages/recurrence` owns every calculation above: Occurrences in a range, the fire time of a Task Reminder for a Recipient, Pet birthdays. It is pure — the current instant comes in as an argument — and covered by dense unit tests, DST transitions and month ends included.
- Services in `apps/api` call it synchronously whenever a source changes (a Task, its Recipients or completions, «Готово», «Отложить», Pet archive, a Member leaving or changing zone) and rewrite only that source's `reminder_dispatch` rows. Cron consumes ready rows and advances `next_fire_at` after sending.
- The Mini App imports the same package for the «Дела» list and calendar, so the screen and the bot agree on every date.
- Formatting for display lives in `apps/web` `common/format-date`, in the viewer's zone and Russian locale.
