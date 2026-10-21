import type { Update } from "@grammyjs/types";
import { Hono } from "hono";

import type { AppEnv } from "./app.types.ts";

const unauthorizedStatus = 401;

// Telegram re-sends an update until it gets a 200, so an unreadable one is dropped.
async function readUpdate(request: Request): Promise<Update | undefined> {
  try {
    return await request.json<Update>();
  } catch {
    return undefined;
  }
}

export const webhookRoute = new Hono<AppEnv>().post("/bot/webhook", async (context) => {
  if (context.req.header("x-telegram-bot-api-secret-token") !== context.env.WEBHOOK_SECRET) {
    return context.body(null, unauthorizedStatus);
  }

  const update = await readUpdate(context.req.raw);

  if (update?.callback_query) {
    await context.var.familyRequests.handleCallback(update.callback_query);
  }

  if (update?.my_chat_member) {
    await context.var.photoStorage.handleChatMember(update.my_chat_member);
  }

  return context.body(null);
});
