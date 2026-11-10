# The writing module names what it changed, and each entry point flushes once

[ADR 0010](0010-live-updates-through-a-family-durable-object.md) let a middleware on non-GET `/api/*` signal the module from the request path, and the bot webhook signal `tasks` and `pet` after every press. The modules that write knew nothing of it, so a Push «Готово» — a request without a session (ADR 0016) — never signalled, a photo added to a Pet's Album never told `pet` about the Care Entry it created, and the bot signalled on refusals too.

## Decisions

- **The service that writes calls `live.changed(familyId, modules)`** with exactly what it changed: a Task linked to a Pet names `tasks` and `pet`, a Task without one only `tasks`; a photo added to a Pet's Album names `albums` and `pet`. A refusal or a snooze changes nothing any screen reads and calls nothing. A completed Occurrence signals from the Task service, so the app, the bot and a Push share one path.
- **A collector per entry point.** The services are built anew for each HTTP request, bot update and cron tick; the collector built with them keeps the changed modules per Family and flushes once, in `waitUntil` for HTTP and the webhook, awaited after a cron tick. It flushes even when the response failed: a needless refetch is cheap, a missed one is the bug.
- **The writer id belongs to the entry point.** The HTTP collector takes it from `x-live-client`; the bot, a Push and the cron have none, and the services never see it.
- **`modulesOfPath` stays in the contract only for the web client's own-write bump** ([ADR 0018](0018-live-versions-per-module-and-the-writers-own-refetch.md)); the Worker no longer reads the path.

## Considered Options

- **Keep the path middleware and add the Push route and the album case to its map** — the smallest change, but every new entry point or cross-module write is another hole that only a review finds.
- **Each `changed` call fetches the Object at once** — no collector, but one request sends several signals and bumps versions in pieces, so Today and the Feed may load twice.
- **A map in `live` of which module each module's readers follow** — the writer names only itself, but the map cannot tell a Task with a Pet from one without.
