---
name: temporal-dates
description: Dates and times in Family Hub with Temporal (`temporal-polyfill`) — floating dates versus moments in a zone, Recurrence and Occurrences, Due Dates, Reminder fire times per Recipient, storage formats and `packages/recurrence`. Load when code computes, stores, compares or formats a date, a time or a time zone.
---

# Dates and times

All date math runs on Temporal from `temporal-polyfill` (`import { Temporal } from "temporal-polyfill"`), the same in the Mini App, the Worker and tests. `Date` appears only at the edges that hand out epoch milliseconds: the `Clock` in `apps/api/src/common/clock` and Drizzle rows.

## Two kinds of time

Every value is one of these; decide which before writing code.

| Kind | Temporal type | Stored as | Examples |
| --- | --- | --- | --- |
| **Floating date** — the same calendar day in every zone | `Temporal.PlainDate` | `TEXT` `YYYY-MM-DD` | all-day Event, Pet birthday, Due Date, Savings Goal deadline, Contribution day |
| **Moment** — one instant, entered in its creator's zone | `Temporal.ZonedDateTime` in code, `Temporal.Instant` at rest | `INTEGER` epoch ms UTC + `TEXT` IANA zone of the creator | timed Event, standalone Reminder, `next_fire_at`, every `created_at` / `updated_at` |

- A moment keeps its creator's zone next to it because Recurrence is computed in that zone: a weekly 19:00 stays 19:00 across a DST change.
- A Member sees moments in their own zone, taken from the device and editable in settings.
- Converting a floating date to a moment needs an explicit zone and time of day; there is no implicit "local".

## Rules the product fixed

- **Recurrence** is weekly, monthly or yearly with an optional end date, no "every N". It is evaluated in the creator's zone. A monthly series on the 31st falls on the last day of shorter months. Edits apply to the whole series; single Occurrences are skipped through `skipped_dates`.
- **Occurrences, Pet birthdays and Due Dates are computed, never stored.** The stored inputs are the rule, `skipped_dates`, the Pet's `birth_date` and the Care Entry's `due_date`.
- **Fire time depends on the Recipient**: Reminders of all-day Events, Pet birthdays and Due Dates fire at 09:00 in each Recipient's zone. Event Reminders offset from the start: at start, 15 min, 1 h, 1 day, 1 week before.
- **Due Date** Reminders fire 7 days before and on the day; overdue ones repeat every 7 days until a new Care Entry of the same kind closes them.
- **Lateness**: more than 12 hours late, an Event or standalone Reminder moves silently to its next Occurrence; a Due Date one is always sent.

## Where the math lives

- `packages/recurrence` owns every calculation above: Occurrences in a range, the next fire time for a Recipient, Due Date schedules. It is pure — the current instant comes in as an argument — and covered by dense unit tests, DST transitions and month ends included.
- Services in `apps/api` call it synchronously whenever a source changes (Event, Reminder, Care Entry with a Due Date, Recipients, «Готово», «Отложить», Pet archive, a Member leaving or changing zone) and rewrite only that source's `reminder_dispatch` rows. Cron consumes ready rows and advances `next_fire_at` after sending.
- The Mini App imports the same package for calendar grids and «Ближайшее», so the screen and the bot agree on every date.
- Formatting for display lives in `apps/web` `common/format-date`, in the viewer's zone and Russian locale.
