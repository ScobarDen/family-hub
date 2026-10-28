# The session token renews while the app stays open

[ADR 0006](0006-session-token-carries-only-member-id.md) gives the app a 24-hour token in memory, exchanged for initData at launch. A Mini App left open on Telegram Desktop, or kept alive in the background on a phone, outlives it, and the next request answered 401 with «перезапустите приложение». initData cannot help: Telegram does not refresh it while the app stays open, and the Worker accepts it only for an hour.

## Decisions

- **The app renews a still-valid token for a new one.** When the app comes back on screen and its token is older than 12 hours, it asks the Worker for a fresh token with the current one. Membership is read from the database on every request as before, so a removed Member cannot renew into the Family.
- **initData stays a launch-only credential.** Requests keep carrying the Worker's own token; initData is not sent with every request.
- **The token stays in memory.** Nothing is persisted; the next launch signs in with its fresh initData.

## Considered Options

- **`Authorization: tma <initData>` on every request** — no session at all, but initData older than an hour would have to be accepted, turning an intercepted initData into a day-long credential that cannot be revoked.
- **A longer-lived token (7–30 days)** — the same effect without a renew call, but a leaked token lives as long, and nothing ever decides not to extend it.
- **Keep the 401 and the restart message** — no work, but a Member who leaves the app open on the desktop meets it daily.
