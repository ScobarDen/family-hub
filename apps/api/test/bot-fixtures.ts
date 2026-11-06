import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

export { denis, request };

export const stranger = { id: 999, first_name: "Незнакомец" };

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
