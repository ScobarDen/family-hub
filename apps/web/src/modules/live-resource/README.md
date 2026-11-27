# live-resource

`reatomLiveResource`: every read of Family data ([ADR 0020](../../../../../docs/adr/0020-every-server-read-is-a-live-resource.md)). The linter forbids `withAsyncData` anywhere else, except for the reads that follow no live module.

It is built from a name, a required `liveVersion` (`live-updates`), a `load` that may read other atoms, and optionally the device `cache` (`device-cache`) and a `rollback` (`changes`). It hands out:

- `data` — read-only;
- `status` — `loading`, `ready`, `stale` or `failed`: data to show, cached or fresh, is `ready`; a failed refresh keeps it shown as `stale`; `failed` has nothing to show;
- `reload`;
- `change` — applies a local change and restarts a fetch sent before it.

Out of scope: when to refetch (`live-updates`), what is kept on the device (`device-cache`).
