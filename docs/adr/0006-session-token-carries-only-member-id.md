# The session token carries only `memberId`; membership is read on every request

The Worker exchanges a fresh initData for its own HS256 JWT that holds nothing but `memberId` and lives 24 hours in the client's memory. Family membership and the Family Owner role are looked up in D1 on every request, so a Member who was removed or handed over ownership loses those rights at once instead of when the token expires.

## Considered Options

- **Family and role claims in the token** — saves a query per request, but a stale token would keep a removed Member inside the Family for up to a day.
- **Re-validating initData on every request** — initData is not refreshed while the Mini App stays open, so a long session would break.
