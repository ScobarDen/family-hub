# goals

The «Цели» tab: the Family's Savings Goals. «Всего накоплено» sums the Balance of the Shared Goals and the Member's own Private ones, leaving out Completed Goals; below it the Goals still being saved for, the Achieved ones and the archive of Completed Goals. A Goal has a title, a target in whole rubles, an optional deadline, a cover (an icon from a curated set on a badge colour), a note and a visibility.

A Goal shows its progress, what is left and, with a deadline, «~N ₽ / мес» to reach it in time; every Member's «внесено / снято»; and its Contributions and Withdrawals, newest first. A movement may be dated back and may be another Member's money; only the one who recorded it changes or deletes it. The salute goes off when a Contribution reaches the target. Closing a Goal as fulfilled or cancelled asks first and leaves it read-only with its Balance frozen.

The Goal and movement forms are `reatomEditableRecord`s from `common/form`: they map values from a record and into a change, while creating, editing, the saving flags and the refused-submit message are the common module's. The movement form also keeps the Goal it was opened on, which a new movement is added to.

## Injected

- `api` — `createGoalsApi(httpClient)`: the Goals the session Member may see with the total, the Family's Members, creating, changing and closing a Goal, and its movements.
- `goals` — `reatomGoals({ api })`: the list (`withAsyncData`, loaded when the tab subscribes) and the Members; a saved Goal replaces its old copy and recounts the total.
- `telegram` — `showPopup` from `common/telegram` for the confirmations.
- `self` — the session Member's id: a Private Goal takes only its owner's money.
- `today`, `timeZone` — the viewer's date for the monthly hint and new movements, and the zone «Исполнена …» is shown in; the Member's own zone, the device's until it is known.

The server owns the rules: a Balance never drops below zero, Achieved follows the Balance both ways, a Shared Goal never turns Private and a Completed Goal refuses every change. `reatomGoalsScreen` goes to the navigation as the goals module's `nestedBack`.
