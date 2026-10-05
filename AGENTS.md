## Code style

The linter and formatter (`vite.config.ts`) set the style: run `vp run fix` before committing; the pre-commit hook does the same on staged files.

## Architecture

Every app follows FEOD levels (`app` / `pages` / `modules` / `common` / `global`) with role files `{subject}.{role}.ts` and a module's public API in its `index.ts`. The linter and `vp run feod` enforce the import matrix; each app's `AGENTS.md` carries the rules a linter cannot see.

- `apps/web` — [apps/web/AGENTS.md](apps/web/AGENTS.md)
- `apps/api` — [apps/api/AGENTS.md](apps/api/AGENTS.md)
- `packages/contract` — what travels over the wire: Zod 4 schemas, error codes, the `start_param` codec, Care Entry `details`, UUIDv7. Both apps import it as TypeScript source.
- `packages/recurrence` — pure Temporal math for Occurrences, Due Dates and Reminder fire times; see the `temporal-dates` skill.

Dependencies come from the pnpm catalog in `pnpm-workspace.yaml`, added with `vp`; a new runtime library is a decision for the issue, not for the implementation. Decisions with their reasons live in `docs/adr/`.

## Skills by area

Load these before writing code in the area; project rules above and in each app's `AGENTS.md` win over any skill.

- **Anywhere**: `code-craft` (names, signatures, placement), `feod` and `role-files` (where a file goes), `vite` and `pnpm` (toolchain).
- **Tests**: `test-craft`, `testing-best-practices` and `vitest`; plan coverage with `unit-test-grill` / `integration-test-grill`, manual QA cases with `testcase-grill`. Automated tests go through the project's seams only — the Worker harness in `apps/api`, ViewModels and models in `apps/web` — while Playwright and component tests wait until the project adopts them.
- **`apps/web`**: `frontend-mvvm`, `mvvm`, `frontend-boundaries`, `reatom` (+ `reatom-async`, `reatom-field-notes`, `reatom-testing`, `reatom-review` by task), `react-hooks-best-practices`, `reactuse`, `shadcn`.
- **`apps/api`**: `hono`, `workers-best-practices`, `wrangler`, `cloudflare`.
- **Telegram** (Mini App wrapper, initData, `start_param`, bot, photos): `telegram-mini-app`.
- **Dates, times, Recurrence**: `temporal-dates`.

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
