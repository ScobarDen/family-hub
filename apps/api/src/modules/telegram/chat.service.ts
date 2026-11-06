import type { Message } from "@grammyjs/types";

import { ignoringBotErrors, type BotApi } from "./bot.api.ts";

const appOnlyText =
  "Я больше не разбираю сообщения. Добавляйте дела и записи в приложении — там это быстрее.";

// The bot parses no free text or voice: whoever writes to it is sent to the Mini App instead.
export function createChatService({ bot, miniAppUrl }: { bot: BotApi; miniAppUrl: string }) {
  return {
    async answerFreeMessage(message: Message): Promise<void> {
      await ignoringBotErrors(
        bot.call("sendMessage", {
          chat_id: message.chat.id,
          text: appOnlyText,
          reply_markup: {
            inline_keyboard: [[{ text: "Открыть", web_app: { url: miniAppUrl } }]],
          },
        }),
      );
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
