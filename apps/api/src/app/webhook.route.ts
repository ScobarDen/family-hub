import type { CallbackQuery, Message, Update } from "@grammyjs/types";
import { Hono } from "hono";

import type { AppModule } from "@family-hub/contract";

import { httpStatus } from "@/common/errors.lib.ts";
import { reminderCallbackModules, signalFamily } from "@/modules/live";
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
  if (query.data?.startsWith(`${reminderCallbackPrefix}:`) === true) {
    await services.reminders.handleCallback(query);
    await signalPresser(services, { query, modules: reminderCallbackModules, background });

    return;
  }

  await services.familyRequests.handleCallback(query);
}

function isFreeMessage(message: Message | undefined): message is Message {
  if (message?.chat.type !== "private") {
    return false;
  }

  return message.voice !== undefined || message.text?.startsWith("/") === false;
}

function botCommandOf(message: Message | undefined): string | undefined {
  return message?.chat.type === "private" && message.text?.startsWith("/") === true
    ? message.text.split(/\s/u)[0]?.split("@")[0]
    : undefined;
}

function handleBotCommand(
  services: AppServices,
  { message, background }: { message: Message | undefined; background: Background },
): void {
  const botCommand = botCommandOf(message);

  if (message && botCommand === "/today") {
    background.waitUntil(services.reminders.sendToday(message));
  }
}

async function handleUpdate(
  services: AppServices,
  { update, background }: { update: Update; background: Background },
): Promise<void> {
  const { waitUntil } = background;

  if (isFreeMessage(update.message)) {
    waitUntil(services.chat.answerFreeMessage(update.message));
  }

  handleBotCommand(services, { message: update.message, background });

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
