# calendar

The «Календарь» tab: a month grid over the Family's dates and, below it, the selected day and «Ближайшее» for a month ahead — Event Occurrences, the birthdays of the Pets in care and their Due Dates. An Event opens on the Occurrence tapped: change the whole series, skip this one, or delete it if it is the Member's own.

## Injected

- `api` — `createCalendarApi(httpClient)`: the Events the session Member may see, creating, changing, skipping an Occurrence and deleting; the Pets and each Pet's Due Dates.
- `today`, `timeZone` — the viewer's date and zone; still the device's.
- `telegram` — `showPopup` from `common/telegram` for the confirmations.
- `onOpenPet` — opens a Pet's card from its birthday or Due Date; `app/main.tsx` switches to the pet tab.

Occurrences are computed, never stored, by `@family-hub/recurrence` — the same package the Worker uses: a series counts each date from its start (the 31st falls on the last day of a short month), skipped dates drop out, and a timed Event happens at its wall-clock time in the zone it was set in, shown at the viewer's own day and time. A new timed Event takes the creator's zone; an edited one keeps its own. A birthday comes back yearly from the Pet's birth date. `reatomCalendar` goes to the navigation as the calendar module's `nestedBack`.
