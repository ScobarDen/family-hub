# tasks

The «Дела» tab: everything the Family intends to do or has coming up, as one Task ([ADR 0011](../../../../../docs/adr/0011-one-task-instead-of-plans-events-and-reminders.md)). The list groups Occurrences as «Просрочено» (only a Task with Assignees turns Overdue, said in words as well as in red), «Сегодня», «Скоро», «Без срока» and «Выполненные», folded at the bottom; a recurring Task shows its Overdue Occurrences of the last 30 days, today's and the next one. «Мои / Все» narrows the list to the Tasks the Member is assigned to or reminded of. The calendar shows the same Tasks on a month grid with a day's agenda, Pets' birthdays among them; the list or the calendar is remembered per device (`withLocalStorage`, memory when storage is unavailable).

One tap on the circle completes an Occurrence and shows the undo bar: «Отменить» reopens it, and for a Pet's Task «Записать в журнал» opens that Pet's journal through `onRecord`. Each Occurrence of a recurring Task is completed or skipped («Пропустить этот раз») on its own. A Task shows its date, Recurrence, Reminders, note, Subtasks («Шаги · 1 из 3») with their own Assignees and completion, and its Album strip.

«+» opens the form with only the title and the date, the rest folded; it opens expanded for a Pet, a Command Draft and on edit. Reminders without a time offer only «в начале», «за день» and «за неделю», and are dropped, like the Recurrence, when the Task has no date. A Private Task's Assignees and Recipients are its owner or nobody; a Shared Task never turns Private, and a Task with Subtasks never repeats. The Task and Subtask forms are `reatomEditableRecord`s from `common/form`, which own creating, editing, the saving flags and settling a Command Draft.

## Injected

- `api` — `createTasksApi(httpClient)`: the Tasks the session Member may see, the Albums to link, saving and deleting a Task, completing, reopening and skipping an Occurrence, and Subtasks.
- `members`, `pets` — the Family's shared queries from `app/main.tsx`, so every picker shows the same Members and Pets; `reatomTasksScreen` builds `reatomTasks` over them (`withAsyncData`, loaded when the tab subscribes; a saved Task replaces its old copy).
- `liveVersion` — the module's version from `common/live-updates`: another Member's change refetches the list.
- `telegram` — `showPopup` from `common/telegram` for the confirmations.
- `self` — the session Member's id, for «Мои» and the people of a Private Task.
- `viewer` — today and the Member's zone: the groups, a timed Task's time and the calendar are the viewer's own days.
- `onOpenAlbum`, `onOpenPet` — a Task's Album and a birthday in the calendar open in their own modules.
- `onRecord(petId)` — opens a Pet's journal to record what was done.
- `onDraftSaved(draftId)` — a Task saved from a Command Draft settles that draft.

## Handed to others

- `tasksOf(petId)` — the Pet's Overdue and upcoming rows for its card; this module stays their only source.
- `addForPet(petId)` — the form with that Pet chosen.
- `open(taskId)` — a Task on its next open Occurrence, for deep links and the Feed.
- `openDraft(opening)` — the form filled from a Command Draft.
- `completeQuietly(target)` — completes an Occurrence without the undo bar.
- `recordOccurrence(target)` — the bot's «📝 Записать»: waits for the list, completes the Occurrence quietly and calls `onRecord` with the Task's Pet; nothing happens when the Task or its Pet is missing.

The server owns the rules: who sees a Private Task, Overdue for the Feed and the bot, the last Subtask completing its Task, and only the owner deleting one. `reatomTasksScreen` goes to the navigation as the module's `nestedBack`, so Telegram's BackButton closes a form or leaves a Task first.
