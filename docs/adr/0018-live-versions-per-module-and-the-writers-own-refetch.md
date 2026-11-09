# Live updates carry a version per module, and the writer refetches its own change

[ADR 0010](0010-live-updates-through-a-family-durable-object.md) relayed bare module names, echoed every write to its author and refetched every module on every connection. A Member's own write then loaded its lists three times (the module's own reload, the echo, and Today and the Feed through the echo), the first connection repeated the launch's prefetch, and every return to the app reloaded all six modules.

## Decisions

- **The Family's Object keeps a version per module** in its storage, bumps the modules a write names and relays their new versions. A socket that opens is first handed every version. The app's first connection only learns them, since the launch has just loaded; a reconnection refetches only the modules whose version moved meanwhile. The Object still holds no Family data.
- **The writer refetches its own change without waiting for the socket.** The HTTP client reports every successful write, and the app bumps the modules its path names, from the same map the Worker signals with (`modulesOfPath` in the contract). Modules no longer reload by hand after a write, except where the signal does not reach what they show (a photo deleted from a Care Entry or a Recipe).
- **The echo is told apart by a client id**, a random id per app launch sent with each write in `x-live-client` and relayed as `writer`. The writer's app takes the new versions from its echo and refetches nothing.
- **All modules of one burst are bumped together**, in one 300 ms window, so Today and the Feed, which read every module, load once.
- **Today reads itself again on a visit only while the socket is down**, or when what it shows is from another day or failed to load.

## Considered Options

- **Drop the module's reload and rely on the echo** — one load, but a Member's own change waits for the round trip through the Object and is lost with a half-dead socket.
- **Don't echo to the writer at all** — one load of the module, but Today, the Feed and the other modules a write names (a Pet card after a Task) would not refresh for the writer.
- **Versions in memory only** — no storage writes, but a hibernated or restarted Object forgets them and every app sees each module as moved.
