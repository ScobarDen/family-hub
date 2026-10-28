# Haptics

The phone answers a Member's tap the way a native app does: a tick for a selection, a pulse for a result, a warning before an irreversible step. This page is the map every screen follows.

## Where it lives

- `common/telegram` is the only place that touches `Telegram.WebApp.HapticFeedback`. Its `haptics` has five semantic methods: `select`, `success`, `warning`, `error` and `impact(style)`.
- Each method checks the client version (6.1+) and stays silent on older clients and on desktop.
- The same feedback fires at most once per ~80 ms, so quick taps on several checkboxes do not merge into one buzz. Different feedbacks are not throttled against each other.
- ViewModels get `telegram.haptics` (or a `haptics` dependency) from `app/main.tsx` and call it; Views never do. Tests pass `fakeHaptics()` from `common/telegram` and assert its `felt` list.

## Rules

- **One feedback per action.** Completing the last Subtask completes the Task, and a Contribution may make a Goal Achieved: each is still one pulse.
- **Optimistic changes pulse at the tap**, and add `error` if they roll back. The rollback's error comes from `reatomRollbackFailure` in `common/state`, so a module using it gets it for free.
- **Async actions pulse at the result**: `success` when the server takes it, `error` when it refuses. `reatomEditableRecord` and `reatomSubmitFailure` (`common/form`) and `reatomFailure` (`common/state`) do this for forms and commands.
- **Bulk actions pulse once, at the end**: a batch of photos is one `success`, or one `error` if any photo failed.
- **Nothing on navigation, scrolling or live updates**: opening a record, Back, tapping the active tab again, switching months in the calendar, swiping in the photo viewer, a list refreshed by another Member.
- **Destructive confirmations warn.** `isConfirmed` gives `warning` when the popup is destructive; the deletion itself gives nothing.
- There is no Member setting to turn haptics off; Telegram and the phone have their own.

## Map

| Action                                                                                                                                                                                                                                                          | Feedback                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Tab bar switch, Tasks list/calendar switch, «Мои / Все», «Выполненные», chips, filters, calendar day, cook day, pickers (time zone, digest time, tab-bar slot, Command Draft candidate), form chips (assignees, recipients, Reminders, visibility, Recipe tags) | `select`                                            |
| Navigation, Back, scroll, month switch, photo-viewer swipe, live update                                                                                                                                                                                         | none                                                |
| Completed Occurrence or Subtask (one pulse even when it completes the Task)                                                                                                                                                                                     | `success`                                           |
| Un-complete, undo, skip                                                                                                                                                                                                                                         | `select`                                            |
| Cooked, Contribution, Withdrawal (one pulse even when Achieved)                                                                                                                                                                                                 | `success`                                           |
| Form saved, Command Draft created, photos uploaded, Pet avatar set, Family Request sent                                                                                                                                                                         | `success`                                           |
| Validation error, server refusal, rollback, photo upload failed                                                                                                                                                                                                 | `error`                                             |
| Delete confirmation opened (any destructive confirmation: delete, skip, take away Cooked, remove a Member, leave the Family)                                                                                                                                    | `warning`, nothing on the deletion itself           |
| Microphone hold starts                                                                                                                                                                                                                                          | `impact("medium")`                                  |
| Recording sent on release                                                                                                                                                                                                                                       | `impact("light")`                                   |
| Recording too short or cancelled                                                                                                                                                                                                                                | `warning`                                           |
| Copy Invite link, Invite QR recognised                                                                                                                                                                                                                          | not built yet: `select` and `success` when they are |
