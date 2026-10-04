import { Hono } from "hono";
import type { AppEnv } from "./app.types.ts";

export const webhookRoute = new Hono<AppEnv>().post("/bot/webhook", (c) => {
  if (c.req.header("x-telegram-bot-api-secret-token") !== c.env.WEBHOOK_SECRET) {
    return c.body(null, 401);
  }
  return c.body(null, 200);
});
