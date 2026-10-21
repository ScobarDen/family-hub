# pets

The pet tab: the Family's Pets, each one's card and its Pet Memo. With a single Pet that is not archived the tab carries its name and opens straight on its card; with several it is «Питомцы» with a list; with none it offers to add one.

## Injected

- `api` — `createPetsApi(httpClient)`: lists the Family's Pets, adds one, saves its card and its Pet Memo.
- `pets` — `reatomPets({ api })`, the Pets themselves (`withAsyncData`, loaded once the tab bar or the tab subscribes). Its `tabTitle` goes to the tab bar; a saved Pet replaces its old copy in the list.
- `viewer` — today's date and the zone the age and «Обновлено …» are shown in; still the device's, not yet the Member's saved zone.

`reatomPetsScreen` decides what the tab shows (list, card, the card form, the Pet Memo form) and keeps the way back: `app/main.tsx` hands it to the navigation as the pet module's `nestedBack`, so Telegram's BackButton closes a form or returns from a card to the list first. The card is a skeleton in the order of the spec — header, «Скоро», Pet Memo, «Траты за месяц», «Фото», «Журнал» — and the later issues fill the blocks.

Both forms fill their fields with `init` plus a reset of each field, never the form's own `reset`: that one also aborts the next submit.
