# Live updates go through one Durable Object per Family over hibernating WebSockets

A change one Member makes — a new Plan, «Готово» pressed in the bot — used to reach another Member's open app only when they navigated or reopened it. Now every write tells the Family's Durable Object which module changed, and the Object relays that module name to every open app of the Family, which refetches the screens that read that module.

## Decisions

- **One Durable Object per Family**, addressed by the Family id. A plain Worker cannot fan out: each request lives in its own isolate and never sees the other Members' connections.
- **WebSocket with hibernation, not SSE.** An SSE stream keeps the Object awake and billed for as long as an app is open; a hibernating WebSocket costs nothing while idle. The client only listens.
- **The signal is a module name, never a record.** Apps refetch through the ordinary API, so Private records stay filtered by the server and the Object holds no Family data.
- **Every write signals.** A middleware on non-GET `/api/*` sends the module from the path; the bot webhook sends it for callbacks that change data. Superseded by [ADR 0019](0019-the-writing-module-names-what-it-changed.md): the writing module names what it changed. The author's own apps get the signal too; [ADR 0018](0018-live-versions-per-module-and-the-writers-own-refetch.md) tells their echo apart.
- **The session token rides in `Sec-WebSocket-Protocol`**: a browser WebSocket cannot send `authorization`, and a query string would land in the logs.
- **The app connects only while it is on screen** (`visibilitychange`) and on every reconnect refetches what it may have missed while the socket was down — since [ADR 0018](0018-live-versions-per-module-and-the-writers-own-refetch.md), only the modules whose version moved. Bursts are coalesced per module on the client.
- **Last write wins.** A signal refreshes lists and cards; an open form keeps its draft.

## Considered Options

- **SSE from the Durable Object** — what was asked for first, but billed for every open app's whole session.
- **Polling a `/api/changes` endpoint** — no new binding, but a request every few seconds from every open WebView and still seconds of lag.
- **Refetch on focus only** — almost free, but a Member watching the Feed never sees the other's change.
- **Record-level signals carrying data** — fewer refetches, but turns a hint into sync and leaks Private records through the Object.
