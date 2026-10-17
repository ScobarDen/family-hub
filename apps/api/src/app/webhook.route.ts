import type { Update } from "@grammyjs/types";
import { Hono } from "hono";

import type { AppEnv } from "./app.types.ts";

const unauthorizedStatus = 401;

export const webhookRoute = new Hono<AppEnv>().post("/bot/webhook", async (context) => {
  if (context.req.header("x-telegram-bot-api-secret-token") !== context.env.WEBHOOK_SECRET) {
    return context.body(null, unauthorizedStatus);
  }

  const update = await context.req.json<Update>();

  if (update.callback_query) {
    await context.var.familyRequests.handleCallback(update.callback_query);
  }

  return context.body(null);
});
