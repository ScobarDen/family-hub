import type { CallbackQuery, Message, Update, Voice } from "@grammyjs/types";
import { Hono } from "hono";

import { httpStatus } from "@/common/errors";
import { commandCallbackPrefix } from "@/modules/command";
import { reminderCallbackPrefix } from "@/modules/reminder";

import type { AppEnv, AppServices } from "./app.types.ts";

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

function isVoiceCommand(message: Message | undefined): message is Message & { voice: Voice } {
  return message?.chat.type === "private" && message.voice !== undefined;
}

async function handleUpdate(
  services: AppServices,
  { update, waitUntil }: { update: Update; waitUntil: (work: Promise<unknown>) => void },
): Promise<void> {
  if (isCommand(update.message)) {
    waitUntil(services.commands.handleText(update.message));
  }

  if (isVoiceCommand(update.message)) {
    waitUntil(services.commands.handleVoice(update.message));
  }

  if (update.callback_query) {
    await handleCallback(services, update.callback_query);
  }

  // Writing to the bot again is how a Member who had blocked it turns Reminders back on.
  if (update.message?.text?.split(" ")[0] === "/start") {
    await services.members.allowMessages(update.message.from.id);
  }

  if (update.my_chat_member) {
    await services.photoStorage.handleChatMember(update.my_chat_member);
  }
}

export const webhookRoute = new Hono<AppEnv>().post("/bot/webhook", async (context) => {
  const secret = context.env.WEBHOOK_SECRET;

  if (!secret || context.req.header("x-telegram-bot-api-secret-token") !== secret) {
    return context.body(null, httpStatus.unauthorized);
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
