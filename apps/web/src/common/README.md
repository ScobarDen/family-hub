# common

Neutral single files, imported by their path; there is no `index.ts`.

- `http-client.api.ts` — every server call, with the session handling below.
- `http-error.lib.ts` — the client's errors.
- `format-date.lib.ts`, `format-money.lib.ts`, `format-count.lib.ts` — dates, money, and a number with its Russian plural.
- `records.lib.ts` — replacing or dropping a record by id in a loaded list, and `rolledBack` / `rolledBackById`: a rollback that undoes only the records its change touched, so a change made meanwhile stays.

## Session in the HTTP client

The client keeps the session token in memory and holds every request made before sign-in until the token arrives: screens drawn from the device cache load at once, and only the calls that carry initData pass `withoutSession`. It attaches the token and renews it when the app comes back on screen with a token older than 12 hours ([ADR 0013](../../../../docs/adr/0013-the-session-token-renews-while-the-app-stays-open.md)). Any 401 flips `isSessionLost`, which shows «перезапустите приложение».

The Installed App signs in with its Device instead of initData ([ADR 0014](../../../../docs/adr/0014-the-installed-app-signs-in-with-telegram-login-and-keeps-a-device.md)): on a 401 the client signs in again through `reauthenticate` and retries once, and a refused Device goes back to the sign-in screen.
