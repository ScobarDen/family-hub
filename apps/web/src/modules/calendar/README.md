# calendar

The «Календарь» tab: a month grid over the Family's dates and, below it, the selected day and «Ближайшее» for a month ahead — Event Occurrences, the birthdays of the Pets in care, their Due Dates and the deadlines of open Plans and Subplans; missed deadlines lead «Ближайшее» in red. Standalone Reminders sit here too: «Новое напоминание» sets a text, a time in the creator's zone, a Recurrence and the Recipients (everyone by default, or the chosen Members; a Private one only its owner), and a Reminder in «Ближайшее» opens for editing. The bot delivers them. An Event opens on the Occurrence tapped: change the whole series, skip this one, or delete it if it is the Member's own. An Event's form picks up to three Reminders: at the start, 15 minutes, an hour, a day or a week before; an all-day Event offers only the day-sized ones, which the bot sends at 09:00 on each Recipient's clock.

## Injected

- `api` — `createCalendarApi(httpClient)`: the Events and standalone Reminders the session Member may see, the Family's Members as Recipients, creating, changing, skipping an Occurrence and deleting; the Pets and each Pet's Due Dates.
- `today`, `timeZone` — the viewer's date and zone; still the device's.
- `telegram` — `showPopup` from `common/telegram` for the confirmations.
- `self` — the session Member's id.
- `onOpenPlan` — opens a Plan from its deadline; the app's opener switches to the plans tab.
- `onOpenPet` — opens a Pet's card from its birthday or Due Date; the app's opener switches to the pet tab.

Occurrences are computed, never stored, by `@family-hub/recurrence` — the same package the Worker uses: a series counts each date from its start (the 31st falls on the last day of a short month), skipped dates drop out, and a timed Event happens at its wall-clock time in the zone it was set in, shown at the viewer's own day and time. A new timed Event takes the creator's zone; an edited one keeps its own. A birthday comes back yearly from the Pet's birth date. The Event and Reminder forms are `reatomEditableRecord`s from `common/form`: they map values from a record, from a Command Draft and into a change, while creating, editing, the saving flags and settling the draft (`onDraftSaved`) are the common module's. `reatomCalendar` goes to the navigation as the calendar module's `nestedBack`.
