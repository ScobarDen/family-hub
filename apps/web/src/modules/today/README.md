# today

The first tab: the Today hub. It answers «what needs doing now and what's coming» from one `GET /api/today`:

- «Сделать сегодня» — Overdue Plans and Pet Due Dates, then everything on today (Plans, Due Dates, Events, Reminders, birthdays), the same set the morning digest sends, oldest first. Events, Reminders and birthdays have no verb: their row only opens them. Three rows and «Ещё N», which opens the Feed; the header states the full count («10 дел») or that the day is free, and the block goes away when nothing is due. A Plan is completed with one tap: the row leaves and the Plan API completes it at once, so closing the app loses nothing; «Отменить» reopens the Plan and the Subplans that completion closed. The undo has no timer: it stays until «Скрыть» or the next completion, takes focus so the keyboard reaches it, and the page leaves room for it above the tab bar. A completion the server refuses brings the row back and says so. A Due Date's verb («Отметить прививку») opens the Care Entry form prefilled with the Pet, the kind and today.
- «Впереди» — the next three Upcoming with their day and time, and «Вся лента».
- Six section tiles in a fixed order, each with one live number or only its caption; a tile the server could not read keeps its place with its caption alone. The Pets tile opens the only Pet's card, the list for several, or adding a Pet for none.

## Injected

- `api` — `createTodayApi(httpClient)`: the hub's payload, completing and reopening a Plan or its step.
- `today` — the Member's date, for «Сегодня» / «Завтра» and Overdue.
- `onOpen`, `onRecord`, `onOpenSection`, `onOpenFeed` — the app's opener and navigation: a record, a Due Date's follow-up, a section and the Feed open on top of the Today tab.

`nearestGoalId` hands «Разделы» the Goal for «+ Взнос» from the same payload. `reload` refetches; the app calls it whenever the hub is shown again and after a Command Draft is saved.
