import { Hono } from "hono";

import type { AppEnv } from "./app.types.ts";

const unauthorizedStatus = 401;

export const webhookRoute = new Hono<AppEnv>().post("/bot/webhook", (context) => {
  if (context.req.header("x-telegram-bot-api-secret-token") !== context.env.WEBHOOK_SECRET) {
    return context.body(null, unauthorizedStatus);
  }

  return context.body(null);
});
