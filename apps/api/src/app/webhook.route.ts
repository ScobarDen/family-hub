import type { CallbackQuery, Message, Update, Voice } from "@grammyjs/types";
import { Hono } from "hono";

import type { AppModule } from "@family-hub/contract";

import { httpStatus } from "@/common/errors";
import { commandCallbackModules, reminderCallbackModules, signalFamily } from "@/common/live";
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

type Background = { waitUntil: (work: Promise<unknown>) => void; live: Env["LIVE"] };

// A press may change what the presser's Family sees, so their open apps refetch.
async function signalPresser(
  services: AppServices,
  {
    query,
    modules,
    background,
  }: { query: CallbackQuery; modules: AppModule[]; background: Background },
): Promise<void> {
  const membership = await services.auth.memberOf(query.from.id);

  if (membership) {
    background.waitUntil(
      signalFamily(background.live, { familyId: membership.family.id, modules }),
    );
  }
}

async function handleCallback(
  services: AppServices,
  { query, background }: { query: CallbackQuery; background: Background },
): Promise<void> {
  if (query.data?.startsWith(`${commandCallbackPrefix}:`) === true) {
    await services.commands.handleCallback(query);
    await signalPresser(services, { query, modules: commandCallbackModules, background });

    return;
  }

  if (query.data?.startsWith(`${reminderCallbackPrefix}:`) === true) {
    await services.reminders.handleCallback(query);
    await signalPresser(services, { query, modules: reminderCallbackModules, background });

    return;
  }

  await services.familyRequests.handleCallback(query);
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

function botCommandOf(message: Message | undefined): string | undefined {
  return message?.chat.type === "private" && message.text?.startsWith("/") === true
    ? message.text.split(/\s/u)[0]?.split("@")[0]
    : undefined;
}

async function handleBotCommand(
  services: AppServices,
  { message, background }: { message: Message | undefined; background: Background },
): Promise<void> {
  const botCommand = botCommandOf(message);

  if (message && botCommand === "/remind") {
    background.waitUntil(services.commands.handleRemind(message));
  }

  if (message && botCommand === "/today") {
    await services.reminders.sendToday(message);
  }
}

async function handleUpdate(
  services: AppServices,
  { update, background }: { update: Update; background: Background },
): Promise<void> {
  const { waitUntil } = background;

  if (isCommand(update.message)) {
    waitUntil(services.commands.handleText(update.message));
  }

  await handleBotCommand(services, { message: update.message, background });

  if (isVoiceCommand(update.message)) {
    waitUntil(services.commands.handleVoice(update.message));
  }

  if (update.callback_query) {
    await handleCallback(services, { query: update.callback_query, background });
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
      background: {
        waitUntil: (work) => {
          context.executionCtx.waitUntil(work);
        },
        live: context.env.LIVE,
      },
    });
  }

  return context.body(null);
});
