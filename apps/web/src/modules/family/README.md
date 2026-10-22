# family

The Family's Members in the Profile, the Family Owner marked «Владелец», and the ways out of the Family.

## Injected

- `api` — `createFamilyApi(httpClient)`: lists the session Member's Family, leaves it, removes a Member, hands over the Owner role and deletes the Family.
- `telegram` — `showPopup` and `showAlert` from `common/telegram`, for choosing and confirming what happens to a Member and to the Family.
- `self` — the session Member's id and their Family's name, read from the session.
- `members` — `reatomFamilyMembers(api)`, built once in `app/main.tsx` and shared with every module that names Members, so a removed Member leaves their pickers too.
- `onLeft` — called once the Member is out of the Family (left it or deleted it); `app/main.tsx` passes `session.signIn`, which brings the stranger screen.

The list is an async computed (`withAsyncData`) that loads when the Profile opens; whether the session Member owns the Family is read from it, so a handed-over role shows at once. The Family Owner taps another Member for a popup with «Сделать владельцем» and «Исключить», each confirmed in a second popup; a success updates the list in place.

`<FamilyExit />` holds «Покинуть семью» and, for the Family Owner, «Удалить семью». A Member leaves after a confirmation. The Family Owner among other Members is told to hand the role over first; alone, leaving opens the deletion form, as the last Member leaving deletes the Family. Deleting takes typing the Family's name and warns that photos stay in the Family's Telegram channel.
