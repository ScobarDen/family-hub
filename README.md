# Family Hub

Telegram Mini App for one family: feed, tasks, pet, savings goals, recipes and albums. Domain glossary lives in [CONTEXT.md](CONTEXT.md), decisions in [docs/adr](docs/adr).

## Layout

| Path                  | What                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `apps/web`            | Mini App (React), static build for GitHub Pages under `/family-hub/`     |
| `apps/api`            | Cloudflare Worker (Hono + Drizzle on D1): `/api/*`, `/bot/webhook`, cron |
| `packages/contract`   | what travels over the wire, shared by web and api                        |
| `packages/recurrence` | Temporal-based Task Occurrence and Reminder math                         |

Internal packages are TypeScript sources without a build step.

## Commands

Toolchain is [Vite+](https://viteplus.dev) on pnpm; Node from `.node-version`.

```sh
vp install
vp check                       # format, lint (readability rules, FEOD levels and role matrix), typecheck
vp run fix                     # autofix: two passes of vp check --fix; the pre-commit hook runs it on staged files
vp run -r test
vp run @family-hub/web#dev
vp run @family-hub/api#dev     # wrangler dev; secrets in apps/api/.dev.vars (see .dev.vars.example)
vp run @family-hub/api#db:generate
vp run @family-hub/api#cf-typegen
vp run ready                   # everything CI runs
```

Local Worker, Mini App, dev bot and tunnel: [docs/dev.md](docs/dev.md).

## Worker tests

`apps/api/test/worker-harness.ts` runs the whole Worker in Node: HTTP requests, bot webhook updates and cron ticks go through the real routes and Drizzle on in-memory SQLite with the production migrations. Only the Telegram Bot API (`fake-bot-api.ts`) and the clock (`fake-clock.ts`) are fakes.

The in-memory database is Node's built-in `node:sqlite` behind a small D1-compatible binding (`sqlite-d1.ts`), so the Worker gets `env.DB` exactly as in production and no native module has to be built. `sqlite-d1.test.ts` pins the D1 behaviour Drizzle relies on.

Worker code is typechecked without Node types (`tsconfig.worker.json`); tests and configs get them (`tsconfig.node.json`).

## Deploy

Merging into `main` deploys: D1 migrations, the Worker, bot registration, a health check, then the Mini App on GitHub Pages. Pipeline, one-time setup and the production bot rules are in [docs/deploy.md](docs/deploy.md); the manual smoke run for cron and bot changes is [docs/smoke.md](docs/smoke.md).
