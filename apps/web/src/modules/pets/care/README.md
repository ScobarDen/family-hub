# care

A Pet's journal of Care Entries — vaccination, treatment, vet visit, weight, expense and note — with its Pet Expenses and weight chart. It fills the pet card's «Траты за месяц», «Фото» and «Журнал» blocks and, over the card, the entry form and the year's expenses.

## Injected

- `api` — `createCareApi(httpClient)`: a Pet's Care Entries, one Care Entry by its id, adding, correcting and deleting one, and the Pet Expenses of a time range summed by category on the server.
- `petId` — the Pet whose card is open, from the parent `pets` module.
- `today`, `now`, `timeZone` — the viewer's date, time and zone: «this month» and «this year» are counted in it, and a new entry starts at the current minute.
- `telegram` — `showPopup` from `common/telegram` for the delete confirmation.
- `isReadOnly` — whether the open Pet is archived: its journal then shows without any way to write.
- `preparePhoto` — `preparePhoto` from `common/photo`: reads when a picture was taken from its Exif, then shrinks it to 2560 px as a JPEG; over 10 MB it is refused.
- `photoHint` — from `photo-storage`: why photos cannot be added now, shown in the form and the «Фото» block.
- `onMakeAvatar` — makes a photo the open Pet's avatar in the parent `pets` module.
- `onOpenPet` — opens a Pet's card in the parent `pets` module, for an entry opened from outside it.

`openEntry` opens a Care Entry named by an `entry_<id>` link or tapped in the Feed: it takes the entry from the journal if it is there, else asks for it by id (`GET /api/care-entries/:id`), so a journal not yet loaded or another Pet's card does not matter. It then opens the entry's Pet and its form, read-only for an archived Pet; an entry that is gone leaves the screen as it was.

A vaccination, treatment or vet visit offers «Повторить» — a date sent as `repeatOn`, from which the server creates a Task linked to the Pet with the author as Assignee; the Care Entry keeps nothing of it, so editing an entry starts with the field empty. A Command Draft's `repeatOn` fills it in. The field is sent only for those three kinds, even if a date was typed before the kind was switched.

The journal, the month and the year are async computeds keyed by the Pet that reload together after every change (`care.model.ts`). The form is a `reatomEditableRecord` from `common/form`, so a Command Draft is settled (`onDraftSaved`) the way the tasks module's are, and with no Pet open it says the entry could not be saved instead of closing as if it were. It names a field to fix from the contract's `details` schema, so the rules of each Care Kind (an integer of rubles, a weight in steps of 0.1 kg, the vaccine or the treatment target) live in `@family-hub/contract` only. The cost of a vaccination, treatment or vet visit is a Pet Expense of the vet or of medicine. The parent's `reatomPetTab` puts `canGoBack` and `back` ahead of the card's own, and its `PetTab` shows `Care` instead of the card while a form or the year's expenses are open.

An entry takes up to five photos. Each goes up to the Family's Photo Storage the moment it is picked (`POST /api/photos`), so saving only links the uploaded ones; the Worker hands back signed paths of its own, which the api turns into URLs on the Worker's origin. Thumbnails sit under each entry and in the «Фото» block; a tap opens the full-screen viewer, where the uploader or the Family Owner deletes a photo and anyone makes it the Pet's avatar.
