import type { Message } from "@grammyjs/types";

import { quotaText } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import {
  isOverQuota,
  membershipOf,
  outcomeOf,
  reply,
  sendPreview,
  showTyping,
} from "./draft.service.ts";

// A Member writes the bot a plain message; it answers with a draft to confirm, never a record.
export async function handleText(
  dependencies: CommandDependencies,
  message: Message,
): Promise<void> {
  const chatId = message.chat.id;
  const membership = await membershipOf(dependencies, message);

  if (membership === undefined) {
    return;
  }

  if (await isOverQuota(dependencies, membership)) {
    await reply(dependencies, { chatId, text: quotaText });

    return;
  }

  await showTyping(dependencies, chatId);

  const outcome = await outcomeOf(dependencies, { membership, text: message.text ?? "" });

  await sendPreview(dependencies, { membership, chatId, source: "bot_text", outcome });
}
