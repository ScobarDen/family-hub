# Every server read in the app is a live resource

Each loaded list assembled the same recipe by hand: a local version atom, an async `computed` reading it and an optional `liveVersion`, `withAsyncData`, the device cache and rollback on its `data`, a `reload` action, and a `loading | failed | ready` state derived in each ViewModel. Since nothing required the live version, the open Recipe stopped refreshing once [ADR 0018](0018-live-versions-per-module-and-the-writers-own-refetch.md) removed its manual reload, and no test noticed. Now one module, `live-resource`, builds every read of Family data, and the live version is a required input.

## Decisions

- **This narrows [ADR 0012](0012-screens-render-from-a-device-cache-before-sign-in.md)'s "one extension, not a resource framework".** The resource owns the version, the live subscription, the device cache, rollback and the status; it still has no cache by parameters and no `withCache`. A read that depends on other atoms (an opened id, today's date) reads them inside its load, and they restart it like any dependency.
- **The live version is required.** A model receives `liveVersion: () => number` from the composition root (`live.versionOf(module)` or `live.all`), so a test passes a plain atom and a model never imports `live-updates`.
- **A local change goes through the resource**, which restarts a fetch already in flight: a fetch sent before a save answers with the record as it was.
- **The status is one union.** `ready` means there is data to show, cached or fresh; `failed` means an error and nothing to show; a failed refresh keeps what is shown.
- **Rollback lives on the resource, the failure bar on the screen.** A resource may declare how its data rolls back; `reatomOptimistic` and the failure bar stay in `changes`, because one screen may write to a resource it does not show (Today completes a Task).
- **The linter forbids `withAsyncData` outside the module**, except for tests and the reads that follow no live module (sign-in, an Invite preview, Devices, Invites, Photo Storage).
- **The Family's Members follow the `feed` version**, the one a write to the Family moves; the Albums a Task may link follow `albums`.
- **Today no longer reloads itself after a completion**: completing and reopening go through the Tasks path, whose own-write bump already refetches it.

## Considered Options

- **Keep the recipe and make `liveVersion` required** — the smallest change, but the stale-fetch guard, the status and the cache wiring stay copied eight times and drift as `goals.keep` and the Pets already had.
- **A lint rule or a test per model** that checks the live version is read — catches the one bug, not the rest of the copies.
