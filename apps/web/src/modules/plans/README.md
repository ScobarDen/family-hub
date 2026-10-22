# plans

The «Планы» tab: the Family's Plans with their Subplans, Assignees and progress. The list goes by due date with undated Plans last; «Выполненные» stay folded under their own row and open again into work from the Plan. A Plan shows its due date, Assignee, note, «Шаги · 1 из 3» and who completed it and when. A Plan or Subplan with a due date may get a Reminder on the day, a day or a week before at 09:00: the bot sends it to the Assignee, or to everyone without one (a Private Plan only to its owner), and «✅ Выполнено» there completes it.

## Injected

- `api` — `createPlansApi(httpClient)`: the Plans the session Member may see, their Subplans, completing and reopening, and the Family's Members for the Assignee choice.
- `plans` — `reatomPlans({ api })`: the Plans (`withAsyncData`, loaded when the tab subscribes) and the Members; a saved Plan replaces its old copy and keeps the list sorted.
- `telegram` — `showPopup` from `common/telegram` for the confirmations.
- `self` — the session Member's id: a Private Plan's Assignee is its owner or nobody.
- `timeZone` — the zone «Выполнено …» is shown in; still the device's.

A Plan may keep its photos in one of the Family's Albums, chosen in the form: the Plan then shows a strip of its first photos and «Открыть альбом», which `onOpenAlbum` takes to the albums tab. A Plan may belong to a Pet, chosen in the form among the Pets that are not archived. `openPlansOf(petId)` hands the pet card the Pet's open Plans for its «Скоро» block, and `addForPet(petId)` opens the form with that Pet chosen; deleting a Pet unlinks its Plans, which stay here.

The server owns the rules: the last Subplan completes the Plan, an unticked one reopens it, completing a Plan by hand completes its open Subplans (the ViewModel asks first), a Shared Plan never turns Private, and only a Plan's owner deletes it. The ViewModel keeps the list in step with every answer and warns when a Subplan is due after its Plan. The Plan and Subplan forms are `reatomEditableRecord`s from `common/form`, which own creating, editing and the saving flags; the Subplan form also keeps the Plan it was opened on, which a new Subplan is added to. `reatomPlansScreen` goes to the navigation as the plans module's `nestedBack`, so Telegram's BackButton closes a form or leaves a Plan first.
