# Deploy

A merge into `main` releases Family Hub through `.github/workflows/deploy.yml`. Runs are serialised by `concurrency` and never cancelled midway.

1. **`deploy-api`** (GitHub environment `production`)
   1. `wrangler d1 migrations apply family-hub --remote` — expand-only, see `apps/api/migrations/README.md`.
   2. Secrets from the `production` environment are written to a secrets file (the run fails first if any secret or variable is empty).
   3. `wrangler deploy --secrets-file …` — the secrets ride with the new version.
   4. Bot registration, idempotent: `setWebhook` with the secret token, `setMyCommands`, `setChatMenuButton`.
   5. Smoke check: `GET $API_URL/api/health` must answer `{"status":"ok"}`.
2. **`deploy-web`** — builds `apps/web` with `VITE_API_URL` set to `API_URL` and `VITE_BOT_USERNAME` to `BOT_USERNAME` (the bot of the Installed App's Telegram Login) and publishes it to GitHub Pages.

Any failing step stops the chain. A failed configuration check, migration or `wrangler deploy` leaves the previous Worker live, and the Mini App is published only after the Worker passed its smoke check. A failure in bot registration or the smoke check comes **after** the new Worker went live: production then runs the new Worker with the previous Mini App, and rolling back is a manual decision.

GitHub emails the person who triggered a failed run (Settings → Notifications → Actions: «Notify me only for failed workflows», email on). When someone else triggered it — a Renovate automerge above all — the `report-failure` job opens an issue assigned to the repository owner, which sends the email instead.

Secrets are upserted: one missing from the `production` environment fails the run, but removing a secret for good also needs `vp exec wrangler secret delete <NAME>` in `apps/api`.

There is no automatic rollback. To roll back the Worker: `vp exec wrangler rollback` in `apps/api` (or Workers → Deployments in the dashboard), or revert the commit on `main`. The database is never rolled back by hand during an incident; D1 Time Travel keeps 7 days if it truly has to be.

## One-time setup

### Cloudflare

1. `vp exec wrangler d1 create family-hub` in `apps/api`. The config finds the database by name, so no id goes into `wrangler.jsonc`.
2. An API token with **Workers Scripts: Edit** and **D1: Edit** on the account.
3. The `workers.dev` subdomain of the account gives the API URL: `https://family-hub-api.<subdomain>.workers.dev`.

### GitHub

- Environment **`production`**:
  - secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BOT_TOKEN`, `JWT_SECRET`, `WEBHOOK_SECRET`, `OPERATOR_TELEGRAM_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (one key pair for Push, base64url as `npx web-push generate-vapid-keys` prints it; a new pair drops every push subscription, so generate it once);
  - variables `API_URL` (the Worker origin, no trailing slash) `MINI_APP_URL` (`https://scobarden.github.io/family-hub/`) and `BOT_USERNAME` (the bot's username without `@`).
  - The Worker answers CORS only for `ALLOWED_ORIGINS` in `apps/api/wrangler.jsonc`; keep it equal to the origin of `MINI_APP_URL`.
  - The deploy hands `MINI_APP_URL` to the Worker too, for the «Открыть Family Hub» button in bot messages; the value in `wrangler.jsonc` is only the fallback.
  - `WEBHOOK_SECRET` may contain only `A-Z`, `a-z`, `0-9`, `_` and `-` (Telegram's rule), e.g. `openssl rand -hex 32`.
- Settings → Pages → Source: **GitHub Actions**.
- Branch protection on `main`: require the `check` job of the CI workflow and **require branches to be up to date**, so that what lands on `main` is exactly what CI checked.
- Settings → General: **Allow auto-merge**, and install the Renovate GitHub app on the repository (config in `renovate.json`).

### Production bot

- In BotFather: **Bot Settings → Configure Mini App → Enable Mini App** with `MINI_APP_URL`, so the bot gets the «Открыть» button in the chat list (Main Mini App). Repeat for the dev bot with its own URL.
- In BotFather: `/setdomain` for the bot with the GitHub Pages host (`scobarden.github.io`), so Telegram Login works in the Installed App. Telegram Login does not work on `localhost`: check it locally with a dev bot whose domain is a tunnel, never with a sign-in bypass.
- **Never recreate the production bot.** Photos live in Family channels where this bot is an admin, and every `file_id` is bound to it; a new bot loses access to all of them. If the token leaks, `/revoke` it in BotFather, put the new token into the `BOT_TOKEN` secret and re-run the deploy workflow (Actions → Deploy → Run workflow).
- Commands, the menu button and the webhook are owned by the deploy workflow; changes made by hand in BotFather are overwritten by the next deploy.
