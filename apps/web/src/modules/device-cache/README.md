# device-cache

The last loaded data kept in Telegram DeviceStorage, or in memory where it is missing, so screens render before sign-in ([ADR 0012](../../../../../docs/adr/0012-screens-render-from-a-device-cache-before-sign-in.md)).

`withDeviceCache` is wired through a live resource's `cache`, with a key, the contract schema, a version and optionally `cachedPart`: what of the state to keep (`undefined` keeps the earlier copy). It drops what does not parse, an older version or anything older than 30 days. `keepFor` clears it for another Member or Family, `clear` for a stranger.

Out of scope: loading and refetching (`live-resource`).
