import type { Message } from "@grammyjs/types";

import { quotaText, remindUsageText } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import {
  reserve,
  membershipOf,
  outcomeOf,
  reply,
  sendPreview,
  showTyping,
} from "./draft.service.ts";

const remindPattern = /^\/remind(?:@\w+)?/u;

async function draftFrom(
  dependencies: CommandDependencies,
  { message, text }: { message: Message; text: string },
): Promise<void> {
  const chatId = message.chat.id;
  const membership = await membershipOf(dependencies, message);

  if (membership === undefined) {
    return;
  }

  if (text === "") {
    await reply(dependencies, { chatId, text: remindUsageText });

    return;
  }

  const reservation = await reserve(dependencies, { membership, chatId, source: "bot_text" });

  if (reservation === undefined) {
    await reply(dependencies, { chatId, text: quotaText });

    return;
  }

  await showTyping(dependencies, chatId);

  const outcome = await outcomeOf(dependencies, { membership, text });

  await sendPreview(dependencies, { membership, chatId, reservation, outcome });
}

// A Member writes the bot a plain message; it answers with a draft to confirm, never a record.
export async function handleText(
  dependencies: CommandDependencies,
  message: Message,
): Promise<void> {
  await draftFrom(dependencies, { message, text: message.text ?? "" });
}

export async function handleRemind(
  dependencies: CommandDependencies,
  message: Message,
): Promise<void> {
  const text = (message.text ?? "").replace(remindPattern, "").trim();

  await draftFrom(dependencies, { message, text });
}
