# Family Hub

Telegram Mini App for one family: feed, plans, calendar, pet, savings goals and albums. Domain glossary lives in [CONTEXT.md](CONTEXT.md), decisions in [docs/adr](docs/adr).

## Layout

| Path                  | What                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `apps/web`            | Mini App (React), static build for GitHub Pages under `/family-hub/`     |
| `apps/api`            | Cloudflare Worker (Hono + Drizzle on D1): `/api/*`, `/bot/webhook`, cron |
| `packages/contract`   | what travels over the wire, shared by web and api                        |
| `packages/recurrence` | Temporal-based occurrence and reminder math                              |

Internal packages are TypeScript sources without a build step.

## Commands

Toolchain is [Vite+](https://viteplus.dev) on pnpm; Node from `.node-version`.

```sh
vp install
vp check                       # format, lint (FEOD role matrix), typecheck
vp run feod                    # FEOD levels and deep imports
vp run -r test
vp run @family-hub/web#dev
vp run @family-hub/api#dev     # wrangler dev; secrets in apps/api/.dev.vars (see .dev.vars.example)
vp run @family-hub/api#db:generate
vp run @family-hub/api#cf-typegen
vp run ready                   # everything CI runs
```

## Worker tests

`apps/api/test/worker-harness.ts` runs the whole Worker in Node: HTTP requests, bot webhook updates and cron ticks go through the real routes and Drizzle on in-memory SQLite with the production migrations. Only the Telegram Bot API (`fake-bot-api.ts`) and the clock (`fake-clock.ts`) are fakes.

The in-memory database is Node's built-in `node:sqlite` behind a small D1-compatible binding (`sqlite-d1.ts`), so the Worker gets `env.DB` exactly as in production and no native module has to be built. `sqlite-d1.test.ts` pins the D1 behaviour Drizzle relies on.

Worker code is typechecked without Node types (`tsconfig.worker.json`); tests and configs get them (`tsconfig.node.json`).
