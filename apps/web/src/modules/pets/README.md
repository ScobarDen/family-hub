# pets

The pet tab: the Family's Pets, each one's card and its Pet Memo, with the `care` submodule's journal on the card. With a single Pet that is not archived the tab carries its name and opens straight on its card; with several it is «Питомцы» with a list; with none it offers to add one.

## Injected

- `api` — `createPetsApi(httpClient)`: lists the Family's Pets, adds one, saves its card and its Pet Memo.
- `pets` — `reatomPets({ api })`, the Pets themselves (`withAsyncData`, loaded once the tab bar or the tab subscribes). Its `tabTitle` goes to the tab bar; a saved Pet replaces its old copy in the list.
- `careApi`, `now`, `telegram`, `preparePhoto`, `photoHint`, `onDraftSaved` — handed on to the `care` submodule (see its README).
- `plansOf`, `onOpenSoon`, `onPlan` — `plansOf` is the Pet's open Plans from the `plans` module; `reatomPetTab` adds the `care` submodule's Due Dates for «Скоро» (by date, undated last, overdue flagged). Opening one (a Plan in the Plans tab, a Due Date as the next entry of the same kind and name, which closes it) and «Запланировать» for this Pet go to the app's opener.
- `isFamilyOwner` — from the session: only the Family Owner deletes a Pet forever.
- `viewer` — today's date and the zone the age and «Обновлено …» are shown in; the Member's own zone, the device's until it is known.

- `route` — the app's navigation: a Pet's card is the `/pets/:petId` screen on the current tab's stack, so Back, a deep link and a reload land on the same Pet. `open` pushes a card, `close` steps back off one (after the Pet is deleted).

`showChoice` brings the list back for a Command Draft of a Care Entry that names no Pet; with one Pet in care its card opens at once. The app's opener waits for `openedPetId` before it opens the draft's form.

`reatomPetTab` wires `reatomPetsScreen` and the `care` submodule: the open Pet, whether it is archived and its avatar go to care, care's Due Dates come back to «Скоро», and `PetTab` shows care's screens over the card while they are open. `reatomPetsScreen` decides what the tab shows (list, card, the card form, the Pet Memo form). `app/main.tsx` hands the tab to the navigation as the pet module's `nestedBack`, so Telegram's BackButton closes care's screens, then a form; leaving a card is the navigation's own step back. A Pet is archived and brought back by any Member from its card; an archived Pet leaves the tab, waits under «Архив» in the list (reached from the card while one Pet is in care) and reads only. Deleting one forever is the Family Owner's, from an archived Pet, after typing its name.

The card follows the spec — header with the avatar, «Скоро», Pet Memo, «Траты за месяц», «Фото», «Журнал»; the expenses, photos and journal blocks come from the `care` submodule through `PetTab`. The header shows the Pet Avatar square; `reatomPetAvatar` uploads one straight from there (`uploadAvatar`, or the Photo Storage hint when none is connected), replaces it, removes it after a confirmation, and `makeAvatar` saves the photo picked in the care module's viewer instead. An archived Pet's avatar reads only.

The profile form is a `reatomEditableRecord` from `common/form`: it maps values from a Pet and into a profile, while creating, editing and the saving flags are the common module's. The Pet Memo form only edits the memo of a Pet that exists, so it has no creating to share and is filled through `fillForm`, never the form's own `reset`, which also aborts the next submit.
