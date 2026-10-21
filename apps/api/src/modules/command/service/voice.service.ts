import type { Message, Voice } from "@grammyjs/types";

import { quotaText, tooLongText, voiceMaxSeconds } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import {
  isOverQuota,
  isQuotaError,
  membershipOf,
  outcomeOf,
  reply,
  sendPreview,
  showTyping,
} from "./draft.service.ts";

const telegramVoiceType = "audio/ogg";

type Heard = { status: "heard"; text: string } | { status: "unheard" } | { status: "quota" };

function transcriptOf(raw: unknown): string {
  const text = typeof raw === "object" && raw !== null && "text" in raw ? raw.text : undefined;

  return typeof text === "string" ? text.trim() : "";
}

async function audioOf(
  { bot }: CommandDependencies,
  voice: Voice,
): Promise<ReadableStream | undefined> {
  const file = await bot.call("getFile", { file_id: voice.file_id });
  const response = file.file_path === undefined ? undefined : await bot.file(file.file_path);

  return response?.ok === true ? (response.body ?? undefined) : undefined;
}

// The audio streams from Telegram straight into Whisper: base64 would spend the 10 ms of CPU.
async function listen(dependencies: CommandDependencies, voice: Voice): Promise<Heard> {
  try {
    const body = await audioOf(dependencies, voice);

    if (body === undefined) {
      return { status: "unheard" };
    }

    const text = transcriptOf(
      await dependencies.model.run(dependencies.speechModel, {
        audio: { body, contentType: voice.mime_type ?? telegramVoiceType },
        language: "ru",
      }),
    );

    return text === "" ? { status: "unheard" } : { status: "heard", text };
  } catch (error) {
    return isQuotaError(error) ? { status: "quota" } : { status: "unheard" };
  }
}

// A voice message goes the way of a text one once Whisper has written it down.
export async function handleVoice(
  dependencies: CommandDependencies,
  message: Message & { voice: Voice },
): Promise<void> {
  const chatId = message.chat.id;
  const membership = await membershipOf(dependencies, message);

  if (membership === undefined) {
    return;
  }

  if (message.voice.duration > voiceMaxSeconds) {
    await reply(dependencies, { chatId, text: tooLongText });

    return;
  }

  if (await isOverQuota(dependencies, membership)) {
    await reply(dependencies, { chatId, text: quotaText });

    return;
  }

  await showTyping(dependencies, chatId);

  const heard = await listen(dependencies, message.voice);

  await sendPreview(dependencies, {
    membership,
    chatId,
    source: "bot_voice",
    ...(heard.status === "heard"
      ? {
          outcome: await outcomeOf(dependencies, { membership, text: heard.text }),
          heard: heard.text,
        }
      : { outcome: heard }),
  });
}
