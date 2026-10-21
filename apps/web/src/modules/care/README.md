# care

A Pet's journal of Care Entries — vaccination, treatment, vet visit, weight, expense and note — with its Pet Expenses and weight chart. It fills the pet card's «Траты за месяц», «Фото» and «Журнал» blocks and, over the card, the entry form and the year's expenses.

## Injected

- `api` — `createCareApi(httpClient)`: a Pet's Care Entries, adding, correcting and deleting one, and the Pet Expenses of a time range summed by category on the server.
- `petId` — the Pet whose card is open, from the `pets` module.
- `today`, `now`, `timeZone` — the viewer's date, time and zone: «this month» and «this year» are counted in it, and a new entry starts at the current minute.
- `telegram` — `showPopup` from `common/telegram` for the delete confirmation.
- `isReadOnly` — whether the open Pet is archived: its journal then shows without any way to write.
- `preparePhoto` — `preparePhoto` from `common/photo`: reads when a picture was taken from its Exif, then shrinks it to 2560 px as a JPEG; over 10 MB it is refused.
- `photoHint` — from `photo-storage`: why photos cannot be added now, shown in the form and the «Фото» block.
- `onMakeAvatar` — makes a photo the open Pet's avatar; `app/main.tsx` hands it to the `pets` module.

The open Due Dates come from the server (`GET /api/pets/:id/due-dates`): the newest entry of each vaccine, treatment target or vet visit holds the date, so the next one closes the last, and overdue is judged in the Member's own zone. `dueSources` hands them to the pet card's «Скоро», and `followUp` opens the next entry of the same kind and name.

The journal, the month and the year are async computeds keyed by the Pet that reload together after every change (`care.model.ts`). The form names a field to fix from the contract's `details` schema, so the rules of each Care Kind (an integer of rubles, a weight in steps of 0.1 kg, the vaccine or the treatment target) live in `@family-hub/contract` only. The cost of a vaccination, treatment or vet visit is a Pet Expense of the vet or of medicine. `app/main.tsx` hands `canGoBack` and `back` to the navigation together with the `pets` module's, and `Home` shows `Care` instead of the card while a form or the year's expenses are open.

An entry takes up to five photos. Each goes up to the Family's Photo Storage the moment it is picked (`POST /api/photos`), so saving only links the uploaded ones; the Worker hands back signed paths of its own, which the api turns into URLs on the Worker's origin. Thumbnails sit under each entry and in the «Фото» block; a tap opens the full-screen viewer, where the uploader or the Family Owner deletes a photo and anyone makes it the Pet's avatar.
