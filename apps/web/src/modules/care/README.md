# care

A Pet's journal of Care Entries — vaccination, treatment, vet visit, weight, expense and note — with its Pet Expenses and weight chart. It fills the pet card's «Траты за месяц» and «Журнал» blocks and, over the card, the entry form and the year's expenses.

## Injected

- `api` — `createCareApi(httpClient)`: a Pet's Care Entries, adding, correcting and deleting one, and the Pet Expenses of a time range summed by category on the server.
- `petId` — the Pet whose card is open, from the `pets` module.
- `today`, `now`, `timeZone` — the viewer's date, time and zone: «this month» and «this year» are counted in it, and a new entry starts at the current minute.
- `telegram` — `showPopup` from `common/telegram` for the delete confirmation.

The journal, the month and the year are async computeds keyed by the Pet that reload together after every change (`care.model.ts`). The form names a field to fix from the contract's `details` schema, so the rules of each Care Kind (an integer of rubles, a weight in steps of 0.1 kg, the vaccine or the treatment target) live in `@family-hub/contract` only. The cost of a vaccination, treatment or vet visit is a Pet Expense of the vet or of medicine. `app/main.tsx` hands `canGoBack` and `back` to the navigation together with the `pets` module's, and `Home` shows `Care` instead of the card while a form or the year's expenses are open.
