# One Task replaces Plans, Events, Reminders and Pet Due Dates

Members kept stopping at «+» to decide whether they were creating a Plan, an Event or a Reminder, and a Pet's next vaccination was a fourth thing again — a Due Date on a Care Entry. All four describe the same idea: something ahead of the Family. They become one Task with an optional date (and time and end), optional Assignees, Recurrence, Reminders, Subtasks and a linked Pet or Album. There is no kind field: what used to be an Event is a Task without Assignees, what used to be a Reminder is a Task with a Reminder on it. Care Entries stay separate because they record the past, which nobody completes or is reminded about.

## Decisions

- **Overdue follows Assignees.** Only a Task Occurrence with Assignees can become Overdue; a birthday or an appointment without them just passes. Any Assignee completes it for all.
- **Completion is per Occurrence**, from the app or from the bot's Reminder. A recurring Task has no Subtasks, and an edit applies to every Occurrence; a single Occurrence can only be skipped.
- **Reminder Recipients default to the Assignees**, or to the author when there are none. Offsets are one set (at the moment, 15m, 1h, 1d, 1w; up to three); for a Task without a time «at the moment» is the morning of that day.
- **Pet follow-ups are Tasks linked to the Pet.** Asking a Care Entry to be repeated creates one with its author as Assignee; completing a Pet-linked Task offers to record a Care Entry. An Archived Pet's Tasks send no Reminders.
- **One set of bot buttons.** Every Reminder has «Готово» and «Отложить» (an hour for a timed Task, a day otherwise); a Pet-linked Task adds «Записать», which completes the Occurrence and opens a prefilled Care Entry. In the app every Task completes with one tap and an undo bar, which offers the Care Entry for a Pet-linked Task.
- **Pet birthdays stay derived** from the Pet's birth date and show beside Tasks; making them Tasks would leave two places to change the date.
- **One module, two views.** Plans and Calendar become «Дела» with a list and a calendar; Command Drafts know only `task` and `care_entry`.
- **Existing data migrates.** Plans keep their Assignee as the only one; Events and Reminders become Tasks without Assignees, Reminders keeping their Recipients; a Care Entry's Due Date becomes a Pet-linked Task assigned to the Care Entry's author, so it still turns Overdue.

## Considered Options

- **Keep the four records and unify only the «+» screen** — least migration, but every list, the Feed, Today and the voice model would still have to tell them apart.
- **One record with a kind field (plan / event / reminder)** — the same zoo in one table; Members would still have to pick a kind.
- **Fold Care Entries in as completed Tasks** — one fewer entity, but a weight or an expense would get Assignees and a completion mark that mean nothing.
- **Overdue for every dated Task** — simpler rule, but birthdays and past appointments would stay red until someone ticked them.
