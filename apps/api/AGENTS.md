# apps/api

One Cloudflare Worker serving `/api/*`, `/bot/webhook` and the per-minute cron. Hono on Workers, Drizzle on D1, the Telegram Bot API through our own client (`telegram-mini-app` skill).

## Shape

- `src/app/index.ts` is the composition root: it builds real dependencies and hands them to `createWorker` in `src/app/worker.ts`, which mounts every route. Dependencies reach the code as arguments; `Clock`, `BotApi` and `PushTransport` (Web Push signed and encrypted by our own WebCrypto code, [ADR 0015](../../docs/adr/0015-own-web-push-encryption-on-webcrypto.md)) are the seams tests replace.
- A domain module is `src/modules/<module>/` with three roles:
  - `*.route.ts` — Hono routes: validate with `@hono/standard-validator` against schemas from `@family-hub/contract`, authorise, call the service, map the result to HTTP.
  - `*.service.ts` — use-cases and policies (Private / Shared visibility, Family Owner rights); receives its repositories as constructor arguments.
  - `*.repo.ts` — the only code that touches the database.
- Shared infrastructure of several files is a module too: `db`, `telegram` (with the Mini App links), `auth`, `visibility` (the Private / Shared policy) and `live` (the Family's Durable Object, `GET /api/live` and the middleware that signals every write, [ADR 0010](../../docs/adr/0010-live-updates-through-a-family-durable-object.md)), and `push` (a Member's push subscriptions and the Web Push transport; the `reminder` module sends through it). One-file neutral entities sit flat in `src/common/` and are imported by their path (`clock.lib.ts`, `errors.lib.ts`, `bind.lib.ts`, `keyset.lib.ts`, `money.lib.ts`, `base64url.lib.ts`), with no `index.ts`; the signed photo links and who may delete a photo live in `photo`. The per-minute cron is `runScheduled` in `src/app/worker.ts`.
- Routes are chained (`new Hono().get(…).post(…)`) and mounted with `.route()`. Request and response shapes live in `@family-hub/contract`; `apps/web` parses responses with those schemas instead of importing the app type.
- Authenticated routes put `requireMember` from `modules/auth` in front; it reads the bearer token and the Member's Family membership from D1 and exposes it as `context.var.membership`.

## Rules

- **Family isolation**: every repository method takes the session's `familyId` as a required argument and filters by it, child tables included. A query without `familyId` is a cross-Family leak. The exceptions: a Member's own `members` row (settings, zone), which belongs to no Family and is addressed by `memberId`, and so are the Member's `devices` (the Installed App's sign-ins, owned by `auth`) and their `push_subscriptions` (owned by `push`); and the Reminder dispatch queue, where the cron claims due `reminder_dispatch` rows of every Family and, stopped by a 429, releases the unsent rest of that same batch, and a bot button names its row by id. Everything read or written after that takes the row's `family_id`, and the Recipient or presser must still be a Member of that Family.
- **Table ownership**: a module's repo touches its own tables. The exceptions are deliberate: `family` departure rewrites the owner of tasks and goals in one batch; the reminder `source` and `album` repos read other modules' tables as read models (joins a public API cannot express); and the Feed sources join what their lines name: `care-entry` reads `pets` for the Pet's name, and the sources of `care-entry`, `task`, `goal`, `recipe`, `album` and `family` read `members` for the Member's name ([ADR 0008](../../docs/adr/0008-feed-merges-sources-from-owning-modules.md)); the Today hub's tile sources live beside them and read the same way, the `care-entry` one reading `pets` for the Pets tile ([ADR 0009](../../docs/adr/0009-today-hub-and-fixed-tab-bar.md)). The `task` repo reads `family_members` to check Assignees and Recipients, and the linked `pets` and `albums` with their photos to show on the Task ([ADR 0011](../../docs/adr/0011-one-task-instead-of-plans-events-and-reminders.md)). The `photo` repo reads every table that shows a photo to forget a replaced Pet Avatar nothing else holds. A new cross-module read belongs to one of these or gets its own line here.
- **Session** ([ADR 0006](../../docs/adr/0006-session-token-carries-only-member-id.md), [ADR 0013](../../docs/adr/0013-the-session-token-renews-while-the-app-stays-open.md)): a JWT (HS256, `hono/jwt`) holding `memberId` and, for the Installed App, the `deviceId` it signed in with, so a revoked or expired Device fails every request and renewal; Family membership and Owner role are read from the database on every request. Sign-in returns the token with the current Member, Family and settings; `POST /api/session/renew` trades a still-valid token for a fresh one. Expired → 401. The Installed App signs in with Telegram Login instead of initData and gets a Device, whose credential (kept hashed) it trades for a token at launch ([ADR 0014](../../docs/adr/0014-the-installed-app-signs-in-with-telegram-login-and-keeps-a-device.md)).
- **Errors** are `{ code, message }` with an HTTP status; `code` comes from the enum in `@family-hub/contract`.
- **Time** comes from the injected `Clock` as epoch ms; date math goes through `@family-hub/recurrence` (`temporal-dates` skill).
- **Ids** are UUIDv7 strings from the `@family-hub/contract` utility, generated in code.
- **D1 writes are the scarce resource** (100k written rows a day, indexes included): rewrite only the rows a change touches, never a table per cron tick.
- **Worker code sees no Node types** (`tsconfig.worker.json`); Web APIs and WebCrypto cover what it needs. Node is for tests and configs.

## Database

- The schema is `src/modules/db/schema.ts`. After changing it run `vp run @family-hub/api#db:generate`, commit the generated SQL in `migrations/` and review it like code. The deploy workflow applies it with `wrangler d1 migrations apply --remote` before the new Worker goes live, so every migration follows the expand / contract rule in [migrations/README.md](migrations/README.md).
- Moments are `INTEGER` epoch ms UTC, floating dates `TEXT` `YYYY-MM-DD`, zones IANA names. Every Family table has `family_id`, `created_at`, `created_by`, `updated_at`. Deletion is physical, cascading from Family and from parent to child; references to a Member never cascade.
- Care Entry kind-specific fields live in the `details` JSON validated by the contract schema; promote a field to a column only to filter, sort or chart on it ([ADR 0001](../../docs/adr/0001-care-entries-single-table-with-json-details.md)).

## Tooling

- `vp run @family-hub/api#dev` runs plain `wrangler dev`; deploy is plain `wrangler deploy`. The Worker builds without the Cloudflare Vite plugin, which has open bugs with Vite+.
- Secrets (`BOT_TOKEN`, `JWT_SECRET`, `WEBHOOK_SECRET`, `OPERATOR_TELEGRAM_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) live in the GitHub environment `production` and reach the Worker with each deploy (`wrangler deploy --secrets-file`, see [docs/deploy.md](../../docs/deploy.md)), locally `.dev.vars`. After editing `wrangler.jsonc` run `vp run @family-hub/api#cf-typegen` and commit `worker-configuration.d.ts`.

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

`test/worker-harness.ts` wires real routes, services, repositories and Drizzle on in-memory SQLite with the production migrations; only the Bot API (`test/fake-bot-api.ts`: records calls, can block a chat with 403 or answer 429), the push transport (`test/fake-push.ts`: records pushes, answers per endpoint) and the clock (`test/fake-clock.ts`) are fakes. Extend the harness and the fakes rather than mocking a module. Services with dense policy logic may add unit tests over fake repositories. Workers specifics the harness cannot reach (bindings, real cron) get a manual smoke run with `wrangler dev`.
