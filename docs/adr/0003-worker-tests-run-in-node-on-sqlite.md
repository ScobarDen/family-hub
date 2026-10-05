# Worker tests run in Node on SQLite, not in workerd

Vite+ ships Vitest 5, and Cloudflare's Vitest integration (`@cloudflare/vitest-plugin`) does not support it yet. Instead of waiting, `apps/api/test/worker-harness.ts` runs the whole Worker in Node: real routes, services, repositories and Drizzle on Node's built-in `node:sqlite` behind a small D1-compatible binding, migrated with the production migrations. Only the Bot API and the clock are faked.

## Considered Options

- **`@cloudflare/vitest-plugin`** — the faithful runtime, but blocked on Vitest 5.
- **`better-sqlite3` / `libsql` through a Drizzle driver** — a native module to build on every machine and CI, and a different driver from the one production runs, so D1 binding behaviour would go untested.
- **Fake repositories everywhere** — fast, but Family isolation and the SQL itself would never be exercised.

## Consequences

- `sqlite-d1.test.ts` pins the D1 behaviour Drizzle relies on; a gap between the shim and real D1 shows up there first.
- Workers-only behaviour (bindings, real cron delivery, runtime limits) is checked by a manual `wrangler dev` smoke run.
- Move to the Workers pool once it supports Vitest 5; the harness API is the seam to keep.
