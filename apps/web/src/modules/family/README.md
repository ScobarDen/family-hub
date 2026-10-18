# family

The Family's Members in the Profile, the Family Owner marked «Владелец».

## Injected

- `api` — `createFamilyApi(httpClient)`: lists the session Member's Family.

The list is an async computed (`withAsyncData`) that loads when the Profile opens. Removing Members and handing over the Owner role live in later issues; Invites are the `invites` module.
