# today

The first tab: the Today hub. It answers «what needs doing now and what's coming» from one `GET /api/today`:

- «Сделать сегодня» — Overdue Task Occurrences, then everything on today (Task Occurrences, dated Subtasks and Pet birthdays), the same set the morning digest sends, oldest first. A birthday has no verb: its row only opens the Pet. Three rows and «Ещё N», which opens the Feed; the header states the full count («10 дел») or that the day is free, and the block goes away when nothing is due. An Occurrence (or a dated Subtask) is completed with one tap: the row leaves and `POST /api/tasks/:id/complete` (or the Subtask's own `complete`) goes out at once, so closing the app loses nothing; «Отменить» reopens it. The undo has no timer: it stays until «Скрыть» or the next completion, takes focus so the keyboard reaches it, and the page leaves room for it above the tab bar. For a Pet's Task the undo also offers «Записать в журнал», which opens the Pet's journal with an entry filled in from the Task through `onOpen`. A completion the server refuses brings the row back and says so in the shared failure bar, or «Нет связи — не сохранилось. Проверьте интернет и повторите.» when the request got no answer. Tapping the rest of a Task line opens the Task.
- «Впереди» — the next three Upcoming with their day and time, and «Вся лента».
- Five section tiles in a fixed order («Дела», Pets, Goals, Albums, Recipes), each with one live number or only its caption; a tile the server could not read keeps its place with its caption alone. «Дела» counts the open Tasks and says how many are Overdue (in red) or else how many fall this week. The Pets tile opens the only Pet's card, the list for several, or adding a Pet for none.

## Injected

- `api` — `createTodayApi(httpClient)`: the hub's payload, completing and reopening a Task Occurrence or a Subtask.
- `deviceCache` — `common/device-cache`: the last Today, stamped with the date it was loaded for, shows at once on the next launch. From another date «Сделать сегодня» stays a skeleton (`isDueOutdated`) until the fresh one arrives, so yesterday's rows are never completed by mistake; «Впереди» and the tiles show from the cache.
- `today` — the Member's date, for «Сегодня» / «Завтра» and Overdue.
- `onOpen`, `onOpenSection`, `onOpenFeed` — the app's opener and navigation: a Task (`{ kind: "task", taskId }`), a Pet, adding a Pet, a section and the Feed open on top of the Today tab.

`nearestGoalId` hands «Разделы» the Goal for «+ Взнос» from the same payload. `reload` refetches; the app calls it whenever the hub is shown again and after a Command Draft is saved.
