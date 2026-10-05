# Manual smoke run

The Worker harness covers behaviour; it cannot reach real bindings, real cron delivery or Telegram itself. Run this checklist on the **dev bot** (`@scobar_family_hub_dev_bot`) before merging a PR that touches the cron, the bot webhook or bot messages. Never point the production bot at a local Worker.

## Setup

1. `apps/api/.dev.vars` holds the dev bot's `BOT_TOKEN`, a `WEBHOOK_SECRET`, a `JWT_SECRET` and your `OPERATOR_TELEGRAM_ID`.
2. `vp exec wrangler d1 migrations apply family-hub --local` in `apps/api`.
3. `vp exec wrangler dev --test-scheduled` in `apps/api`.
4. `cloudflared tunnel --url http://localhost:8787` and note the `https://….trycloudflare.com` URL.
5. Point the dev bot at the tunnel:

   ```sh
   curl -fsS "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
     -d url="$TUNNEL_URL/bot/webhook" -d secret_token="$WEBHOOK_SECRET"
   ```

6. `vp run @family-hub/web#dev` for the Mini App, opened through the dev bot.

A cron tick is fired by hand: `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.

## Checklist

### Worker

- [ ] `GET $TUNNEL_URL/api/health` answers `{"status":"ok"}`.
- [ ] `POST $TUNNEL_URL/bot/webhook` without the `X-Telegram-Bot-Api-Secret-Token` header answers 401.

### Bot

- [ ] `/start` gets an answer from the bot.
- [ ] The menu button and «Открыть» open the Mini App and it signs in.
- [ ] `getWebhookInfo` shows no `last_error_message` after the steps above.

### Cron

- [ ] A tick with nothing due sends nothing and logs no error.
- [ ] A Reminder due now arrives within one tick, exactly once to each Recipient.
- [ ] A second tick right after does not repeat it.
- [ ] A Recipient who blocked the bot is skipped and the others still get the message.
- [ ] The morning digest arrives at the Member's time and an empty one is not sent.

### Reminder buttons

- [ ] «✅ Готово» closes the Reminder for everyone and edits the other Recipients' messages.
- [ ] «⏰ Отложить» postpones only the pressing Recipient's copy; a new message arrives after the delay (move the clock with a manual tick).
- [ ] A button pressed by someone who is not that message's Recipient changes nothing and shows an alert.
- [ ] Due Date buttons «📝 Записать» and «⏰ Отложить на день» behave the same way.

Items for features that are not built yet are skipped until they land.

## After a production deploy

The deploy workflow checks `/api/health` itself. If a bot or cron change shipped, open the production bot once: the menu button opens the Mini App and `/start` answers.
