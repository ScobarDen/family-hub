# apps/api

One Cloudflare Worker serving `/api/*`, `/bot/webhook` and the per-minute cron. Hono on Workers, Drizzle on D1, the Telegram Bot API through our own client (`telegram-mini-app` skill).

## Shape

- `src/index.ts` is the composition root: it builds real dependencies and hands them to `createWorker` in `src/app/worker.ts`, which mounts every route. Dependencies reach the code as arguments; `Clock` and `BotApi` are the seams tests replace.
- A domain module is `src/modules/<module>/` with three roles:
  - `*.route.ts` — Hono routes: validate with `@hono/standard-validator` against schemas from `@family-hub/contract`, authorise, call the service, map the result to HTTP.
  - `*.service.ts` — use-cases and policies (Private / Shared visibility, Family Owner rights); receives its repositories as constructor arguments.
  - `*.repo.ts` — the only code that touches the database.
- Shared infrastructure lives in `src/common/` (`db`, `clock`, `telegram`, then `auth`, `errors`); cron jobs in `src/jobs/`.
- Routes are chained (`new Hono().get(…).post(…)`) and mounted with `.route()` so the app type carries every route for the Hono RPC client `hc` in `apps/web`, which imports the type without building the Worker.

## Rules

- **Family isolation**: every repository method takes the session's `familyId` as a required argument and filters by it, child tables included. A query without `familyId` is a cross-Family leak.
- **Session** ([ADR 0006](../../docs/adr/0006-session-token-carries-only-member-id.md)): a JWT (HS256, `hono/jwt`) holding only `memberId`; Family membership and Owner role are read from the database on every request. Expired → 401.
- **Errors** are `{ code, message }` with an HTTP status; `code` comes from the enum in `@family-hub/contract`.
- **Time** comes from the injected `Clock` as epoch ms; date math goes through `@family-hub/recurrence` (`temporal-dates` skill).
- **Ids** are UUIDv7 strings from the `@family-hub/contract` utility, generated in code.
- **D1 writes are the scarce resource** (100k written rows a day, indexes included): rewrite only the rows a change touches, never a table per cron tick.
- **Worker code sees no Node types** (`tsconfig.worker.json`); Web APIs and WebCrypto cover what it needs. Node is for tests and configs.

## Database

- The schema is `src/common/db/schema.ts`. After changing it run `vp run @family-hub/api#db:generate`, commit the generated SQL in `migrations/` and review it like code. The deploy workflow applies it with `wrangler d1 migrations apply --remote` before the new Worker goes live, so every migration follows the expand / contract rule in [migrations/README.md](migrations/README.md).
- Moments are `INTEGER` epoch ms UTC, floating dates `TEXT` `YYYY-MM-DD`, zones IANA names. Every Family table has `family_id`, `created_at`, `created_by`, `updated_at`. Deletion is physical, cascading from Family and from parent to child; references to a Member never cascade.
- Care Entry kind-specific fields live in the `details` JSON validated by the contract schema; promote a field to a column only to filter, sort or chart on it ([ADR 0001](../../docs/adr/0001-care-entries-single-table-with-json-details.md)).

## Tooling

- `vp run @family-hub/api#dev` runs plain `wrangler dev`; deploy is plain `wrangler deploy`. The Worker builds without the Cloudflare Vite plugin, which has open bugs with Vite+.
- Secrets (`BOT_TOKEN`, `JWT_SECRET`, `WEBHOOK_SECRET`, `OPERATOR_TELEGRAM_ID`) live in the GitHub environment `production` and reach the Worker with each deploy (`wrangler deploy --secrets-file`, see [docs/deploy.md](../../docs/deploy.md)), locally `.dev.vars`. After editing `wrangler.jsonc` run `vp run @family-hub/api#cf-typegen` and commit `worker-configuration.d.ts`.

## Tests

Behaviour is tested through the whole Worker in Node ([ADR 0003](../../docs/adr/0003-worker-tests-run-in-node-on-sqlite.md)):

```ts
const worker = startWorker({ now: "2026-10-04T09:00:00Z" });

await worker.request("/api/…", { method: "POST", body });
await worker.webhook(update);
worker.bot.blockChat(chatId);
worker.clock.set("2026-10-05T09:00:00Z");
await worker.tick();

expect(worker.bot.sentMessages()).toEqual([…]);
```

`test/worker-harness.ts` wires real routes, services, repositories and Drizzle on in-memory SQLite with the production migrations; only the Bot API (`test/fake-bot-api.ts`: records calls, can block a chat with 403 or answer 429) and the clock (`test/fake-clock.ts`) are fakes. Extend the harness and the fakes rather than mocking a module. Services with dense policy logic may add unit tests over fake repositories. Workers specifics the harness cannot reach (bindings, real cron) get a manual smoke run with `wrangler dev`.
