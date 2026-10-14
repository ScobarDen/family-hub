# Local development

The Mini App and the Worker run on your machine against a local D1, and a separate **dev bot** opens them inside Telegram through a `cloudflared` quick tunnel. There is no deployed dev Worker and no staging. Never point the production bot at a local Worker.

## One-time setup

1. Create the dev bot in BotFather (`@scobar_family_hub_dev_bot` for the project owner; any bot of your own works). Keep its token out of the repository.
2. `cp apps/api/.dev.vars.example apps/api/.dev.vars` and fill it in. `.dev.vars` is in `.gitignore`.

   | Variable               | Value                                                           |
   | ---------------------- | --------------------------------------------------------------- |
   | `BOT_TOKEN`            | the dev bot's token                                             |
   | `JWT_SECRET`           | any long random string, e.g. `openssl rand -hex 32`             |
   | `WEBHOOK_SECRET`       | `A-Z`, `a-z`, `0-9`, `_`, `-` only, e.g. `openssl rand -hex 32` |
   | `OPERATOR_TELEGRAM_ID` | your own Telegram user id                                       |
   | `ALLOWED_ORIGINS`      | `http://localhost:5173`, the CORS origin of the local Mini App  |

3. Install `cloudflared` (no Cloudflare account needed for quick tunnels).
4. Apply migrations to the local D1: `vp exec wrangler d1 migrations apply family-hub --local` in `apps/api`. Repeat after pulling a new migration.

## Every session

Three terminals:

1. **Worker** — `vp exec wrangler dev --test-scheduled` in `apps/api` (port 8787). `--test-scheduled` exposes `/__scheduled`, so a cron tick runs only when you fire it.
2. **Mini App** — `vp run @family-hub/web#dev` (port 5173). The Vite dev server proxies `/api` and `/bot` to the Worker, so the Mini App and the bot webhook share one origin and one tunnel.
3. **Tunnel** — `cloudflared tunnel --url http://localhost:5173`; note the `https://….trycloudflare.com` URL as `TUNNEL_URL`.

A quick tunnel gets a new URL on every start, so point the dev bot at it each time:

```sh
curl -fsS "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -d url="$TUNNEL_URL/bot/webhook" -d secret_token="$WEBHOOK_SECRET"

curl -fsS "https://api.telegram.org/bot$BOT_TOKEN/setChatMenuButton" \
  -H "content-type: application/json" \
  -d "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Открыть\",\"web_app\":{\"url\":\"$TUNNEL_URL/family-hub/\"}}}"
```

Open the dev bot and press the menu button. Opened in a plain browser at `http://localhost:5173/family-hub/`, the Mini App has no `initData` and asks to be opened in Telegram.

## Signing in

The Mini App sends `Telegram.WebApp.initData` to `POST /api/session`. A Telegram user who is a Member gets a session; anyone else sees «Family Hub работает по приглашениям». Until Family Requests and Invites land, add yourself to a Family by hand in the local D1:

```sh
vp exec wrangler d1 execute family-hub --local --command "
  insert into members values ('m1', <your telegram id>, 'Денис', 0, 0);
  insert into families values ('f1', 'Гущины', 'm1', 0, 'm1', 0);
  insert into family_members values ('f1', 'm1', 0, 'm1', 0);"
```

initData older than an hour is refused, and the session lives 24 hours in memory; either way the Mini App asks to be restarted.

## Cron by hand

```sh
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

Move the clock by firing ticks; there is no other way to run a scheduled job locally.
