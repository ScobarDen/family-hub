# session

Signs the Member in when the Mini App launches and decides the first screen: the app itself for a Member (passed in as `home`), «Family Hub работает по приглашениям» for a stranger (or the Family Request screen, passed in as `familyRequest`, once they choose «Создать свою семью» or while their request is pending), «Перезапустите приложение» once any request gets a 401.

## Injected

- `api` — `createSessionApi(httpClient)`: exchanges raw `initData` for the session token (kept by the HTTP client in memory, which renews it, [ADR 0013](../../../../../docs/adr/0013-the-session-token-renews-while-the-app-stays-open.md)) and the current Member in one response.
- `telegram` — `initData`, `startParam` and `showAlert` from `common/telegram`.
- `deviceCache` — `common/device-cache`: the Member last signed in on this device, whose shell (`member`) shows while sign-in runs; without it the screen is a skeleton. A launch from an Invite ignores it. Sign-in returning another Member or Family keeps the cache only for the new one, a stranger clears it, a 401 leaves it ([ADR 0012](../../../../../docs/adr/0012-screens-render-from-a-device-cache-before-sign-in.md)). `isSignedIn` tells the cached shell from a signed-in Member.

`session.model.ts` holds the sign-in itself as a Reatom async action (`withAsyncData`); the ViewModel turns its data, its error and the HTTP client's `isSessionLost` into one screen, and hands the signed-in Member with their settings out as `member`. `app/main.tsx` builds the model with `reatomSession({ api, telegram, isJoiningFamily, deviceCache })`, calls `signIn()` and renders `<Session model={…} />`.
