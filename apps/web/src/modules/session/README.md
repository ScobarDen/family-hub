# session

Signs the Member in when the Mini App launches and decides the first screen: a greeting for a Member, «Family Hub работает по приглашениям» for a stranger, «Перезапустите приложение» once any request gets a 401.

## Injected

- `api` — `createSessionApi(httpClient)`: exchanges raw `initData` for the session token (kept by the HTTP client in memory) and loads the current Member.
- `telegram` — `initData` and `showAlert` from `common/telegram`.

`app/main.tsx` builds the model with `reatomSession({ api, telegram })`, calls `signIn()` and renders `<Session model={…} />`.
