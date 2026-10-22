import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";

import type { CommandOutcome, Reminder } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, tokenOf, startWorker } from "./worker-harness.ts";

export { asya, denis, request };

export const stranger = { id: 999, first_name: "Незнакомец" };

// What the Mini App's microphone posts: the recording as the body, typed by its format.
export async function record(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  {
    audio = "mp4:recording",
    type = "audio/mp4",
    length = audio.length,
  }: { audio?: string; type?: string; length?: number } = {},
) {
  const token = await tokenOf(worker, user);

  return worker.request("/api/commands/voice", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": type,
      "content-length": String(length),
    },
    body: audio,
  });
}

export async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-13T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  worker.clock.set("2026-10-13T09:00:01Z");

  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  await request(worker, denis, {
    method: "PUT",
    path: "/api/me/time-zone",
    body: { timeZone: "Europe/Moscow", isAuto: true },
  });

  return Object.assign(worker, { familyId, denisId: ownerId, asyaId });
}

export type Worker = Awaited<ReturnType<typeof startWithFamily>>;

let updateId = 0;

export async function say(worker: Worker, user: TelegramUserFixture, text: string) {
  updateId += 1;

  const update: Update = {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: user.id, type: "private", first_name: user.first_name },
      from: { ...user, is_bot: false },
      text,
    },
  };

  return worker.webhook(update);
}

export async function speak(worker: Worker, user: TelegramUserFixture, { duration = 4 } = {}) {
  updateId += 1;

  return worker.webhook({
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: user.id, type: "private", first_name: user.first_name },
      from: { ...user, is_bot: false },
      voice: {
        file_id: `voice-${updateId}`,
        file_unique_id: `unique-${updateId}`,
        duration,
        mime_type: "audio/ogg",
      },
    },
  });
}

export function lastTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot.sentMessages().findLast(({ chat_id: chatId }) => chatId === user.id);
}

export function buttonsOf(message: ReturnType<typeof lastTo>) {
  const markup = message?.reply_markup as InlineKeyboardMarkup | undefined;

  return markup?.inline_keyboard.flat() ?? [];
}

export async function press(worker: Worker, user: TelegramUserFixture, data: string) {
  updateId += 1;

  await worker.webhook({
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { ...user, is_bot: false },
      chat_instance: "instance",
      data,
    },
  });
}

export function dataOf(message: ReturnType<typeof lastTo>, text: string): string {
  const button = buttonsOf(message).find((each) => each.text === text);

  return button !== undefined && "callback_data" in button ? (button.callback_data ?? "") : "";
}

export const internet = {
  outcome: "reminder",
  text: "Оплатить интернет",
  date: "2026-10-16",
  time: "19:00",
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  recipientIds: null,
  missing: [],
  ambiguities: [],
};

export async function reminders(worker: Worker, user: TelegramUserFixture) {
  const response = await request(worker, user, { path: "/api/reminders" });

  return response.json<Reminder[]>();
}

export async function recorded(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
): Promise<CommandOutcome> {
  const response = await record(worker, user);

  return response.json<CommandOutcome>();
}
