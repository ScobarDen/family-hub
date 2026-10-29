# feed

The «Лента» tab: the Family's chronology, assembled by the Worker on the fly from what the other modules keep. «Просрочено» leads with the Overdue Task Occurrences (each line says «Просрочено» in words, not only in red), «Предстоит» shows the next 14 days — Task Occurrences, dated Subtasks and Pet birthdays — and the Activity follows under «Сегодня», «Вчера» and then by date: Care Entries, one line per completed Task Occurrence or Subtask, Contributions, Withdrawals and Completed Goals, uploads to an Album (one line per Member, Album and burst with pauses under ten minutes) and Members joining. An Activity with photos shows up to three thumbnails and «+N»; a tap opens them full screen. Private records reach only their owner. Activity comes 30 at a time; «Показать ещё» loads the next page. Chips narrow it to one module; «Дела» gathers every Task line, ahead and done.

An Occurrence is ticked off right here (`POST /api/tasks/:id/complete` with its `occurrence`, or the Subtask's own `complete`): its line leaves at once and comes back with the failure bar when the server does not take it. A tap opens the record in its own module.

## Injected

- `api` — `createFeedApi(httpClient)`: the Feed's pages and completing a Task Occurrence or a Subtask.
- `deviceCache` — `modules/device-cache`: the first page of the last launch shows at once; older pages load as before.
- `today`, `timeZone` — the viewer's date and zone for «Сегодня» and «Вчера»; the Member's own zone, the device's until it is known.
- `onOpen` — opens a Task (`{ kind: "task", taskId }`), a Pet's card, a Care Entry's form over its Pet's card, a Savings Goal or an Album; the app's opener switches tabs.

Out of scope: editing a record (its own module), the Today hub (`today`).
