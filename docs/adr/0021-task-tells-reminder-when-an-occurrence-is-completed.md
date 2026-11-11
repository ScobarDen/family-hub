# Task tells Reminder when an Occurrence is Completed; a press borrows `complete` per call

An Occurrence was Completed from the app, the bot, a Push and by `settle` when its last Subtask closed, and each path did its own aftercare: the bot and a Push edited the messages of the pressed offset only, the app edited none, and «is it done» meant `doneAt` for the bot but `doneAt` or the source for a Push. Reminder reached Task through a lazy `() => tasks` to complete from a press, while Task reached Reminder to reschedule.

## Decisions

- **Task calls `schedule.occurrenceCompleted(familyId, { taskId, occurrence, by })` and `schedule.occurrenceReopened(familyId, { taskId, occurrence })`** from every path that completes or reopens an Occurrence, `settle` included; everything else still calls `sourceChanged`. `by` is the Member recorded on the completion, read back after the write, so a second complete from another Member never renames who did it.
- **Reminder owns the aftercare in one place:** on `occurrenceCompleted` it marks the rows of that Occurrence across every offset of the Task, edits their sent messages to «Сделал(а) …», skipping rows already marked, and only then reschedules, so a single Task's rows are read before they are dropped. `occurrenceReopened` clears the marks; edited messages stay as history. A Pet birthday's «Готово» goes through the same aftercare without Task.
- **One «is it closed» rule for the bot and a Push:** `Source.isClosed(occurrence)`. A Task answers from its completions and skipped dates; a birthday, which keeps nothing of its own, from the marks on its rows. A press on a skipped Occurrence no longer completes it.
- **A press borrows `complete` per call:** the bot webhook and the Push press route hand the task service to `handleCallback` and `handlePushPress` as a `TaskCompletion`, so Reminder is built without Task and the cycle in `worker.ts` is gone.

## Considered Options

- **Orchestrate the press in `app`** — Reminder would only parse a press and return «complete X», but the press rules (already closed, snooze, refusal texts) would split between Reminder and the routes.
- **Reminder subscribes to Task after both are built** — removes the import cycle in name only: the late binding stays, just called a subscription.
