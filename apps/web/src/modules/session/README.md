# session

Signs the Member in when the Mini App launches and decides the first screen: the app itself for a Member (passed in as `home`), «Family Hub работает по приглашениям» for a stranger (or the Family Request screen, passed in as `familyRequest`, once they choose «Создать свою семью» or while their request is pending), «Перезапустите приложение» once any request gets a 401.

Outside Telegram this is the Installed App «Домовой» ([ADR 0014](../../../../../docs/adr/0014-the-installed-app-signs-in-with-telegram-login-and-keeps-a-device.md)). It has no initData: the first launch shows «Войдите через Telegram» with the Telegram Login widget of `botUsername`, and a Member's login creates a Device whose id and credential stay in `localStorage`. Later launches sign in with that Device. A refused Device is forgotten and the sign-in screen comes back, and so does any 401 the Device cannot cure (the HTTP client retries once through `reauthenticate`). A Telegram user who is not a Member, or one removed from the Family, sees «Приложение — для участников семьи» with a link to the bot. `signOut` forgets this Device and clears the device cache.

## Injected

- `api` — `createSessionApi(httpClient, localStorage)`: exchanges raw `initData` for the session token (kept by the HTTP client in memory, which renews it, [ADR 0013](../../../../../docs/adr/0013-the-session-token-renews-while-the-app-stays-open.md)) and the current Member in one response; in the Installed App it signs in with Telegram Login or the kept Device instead, and `reauthenticate` is what the HTTP client calls on a 401.
- `botUsername` — `VITE_BOT_USERNAME`, the bot whose Telegram Login the Installed App shows.
- `telegram` — `initData`, `startParam` and `showAlert` from `modules/telegram`.
- `deviceCache` — `modules/device-cache`: the Member last signed in on this device, whose shell (`member`) shows while sign-in runs; without it the screen is a skeleton. A launch from an Invite ignores it. Sign-in returning another Member or Family keeps the cache only for the new one, a stranger clears it, a 401 leaves it ([ADR 0012](../../../../../docs/adr/0012-screens-render-from-a-device-cache-before-sign-in.md)). `isSignedIn` tells the cached shell from a signed-in Member.

`session.model.ts` holds the sign-in itself as a Reatom async action (`withAsyncData`); the ViewModel turns its data, its error and the HTTP client's `isSessionLost` into one screen, and hands the signed-in Member with their settings out as `member`. `app/main.tsx` builds the model with `reatomSession({ api, telegram, isJoiningFamily, deviceCache })`, calls `signIn()` and renders `<Session model={…} />`.

Out of scope: the Family Request form (`family-request`), joining by Invite (`join-family`), the screens behind `home`.
