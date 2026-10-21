import type { CallbackQuery, Message, Update } from "@grammyjs/types";
import { Hono } from "hono";

import { commandCallbackPrefix } from "@/modules/command";
import { reminderCallbackPrefix } from "@/modules/reminder";

import type { AppEnv, AppServices } from "./app.types.ts";

const unauthorizedStatus = 401;

// Telegram re-sends an update until it gets a 200, so an unreadable one is dropped.
async function readUpdate(request: Request): Promise<Update | undefined> {
  try {
    return await request.json<Update>();
  } catch {
    return undefined;
  }
}

async function handleCallback(services: AppServices, query: CallbackQuery): Promise<void> {
  if (query.data?.startsWith(`${commandCallbackPrefix}:`) === true) {
    await services.commands.handleCallback(query);

    return;
  }

  await (query.data?.startsWith(`${reminderCallbackPrefix}:`) === true
    ? services.reminders.handleCallback(query)
    : services.familyRequests.handleCallback(query));
}

// Any plain message in a private chat is a command; the AI work outlasts Telegram's patience.
function isCommand(message: Message | undefined): message is Message & { text: string } {
  return (
    message?.chat.type === "private" && message.text !== undefined && !message.text.startsWith("/")
  );
}

async function handleUpdate(
  services: AppServices,
  { update, waitUntil }: { update: Update; waitUntil: (work: Promise<unknown>) => void },
): Promise<void> {
  if (isCommand(update.message)) {
    waitUntil(services.commands.handleText(update.message));
  }

  if (update.callback_query) {
    await handleCallback(services, update.callback_query);
  }

  // Writing to the bot again is how a Member who had blocked it turns Reminders back on.
  if (update.message?.text === "/start") {
    await services.members.allowMessages(update.message.from.id);
  }

  if (update.my_chat_member) {
    await services.photoStorage.handleChatMember(update.my_chat_member);
  }
}

export const webhookRoute = new Hono<AppEnv>().post("/bot/webhook", async (context) => {
  if (context.req.header("x-telegram-bot-api-secret-token") !== context.env.WEBHOOK_SECRET) {
    return context.body(null, unauthorizedStatus);
  }

  const update = await readUpdate(context.req.raw);

  if (update !== undefined) {
    await handleUpdate(context.var, {
      update,
      waitUntil: (work) => {
        context.executionCtx.waitUntil(work);
      },
    });
  }

  return context.body(null);
});
