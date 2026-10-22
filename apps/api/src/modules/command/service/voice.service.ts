import type { Message, Voice } from "@grammyjs/types";

import { voiceMaxSeconds } from "@family-hub/contract";

import { quotaText, tooLongText } from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";
import {
  reserve,
  isQuotaError,
  membershipOf,
  outcomeOf,
  reply,
  sendPreview,
  showTyping,
} from "./draft.service.ts";

const telegramVoiceType = "audio/ogg";

export type Audio = { body: ReadableStream; contentType: string };

type Heard = { status: "heard"; text: string } | { status: "unheard" } | { status: "quota" };

function transcriptOf(raw: unknown): string {
  const text = typeof raw === "object" && raw !== null && "text" in raw ? raw.text : undefined;

  return typeof text === "string" ? text.trim() : "";
}

// The audio streams straight into Whisper: base64 would spend the 10 ms of CPU.
export async function listen(dependencies: CommandDependencies, audio: Audio): Promise<Heard> {
  try {
    const text = transcriptOf(
      await dependencies.model.run(dependencies.speechModel, { audio, language: "ru" }),
    );

    return text === "" ? { status: "unheard" } : { status: "heard", text };
  } catch (error) {
    return isQuotaError(error) ? { status: "quota" } : { status: "unheard" };
  }
}

async function voiceAudioOf(
  { bot }: CommandDependencies,
  voice: Voice,
): Promise<Audio | undefined> {
  const file = await bot.call("getFile", { file_id: voice.file_id });
  const response = file.file_path === undefined ? undefined : await bot.file(file.file_path);
  const body = response?.ok === true ? response.body : null;

  return body === null ? undefined : { body, contentType: voice.mime_type ?? telegramVoiceType };
}

async function listenToVoice(dependencies: CommandDependencies, voice: Voice): Promise<Heard> {
  try {
    const audio = await voiceAudioOf(dependencies, voice);

    return audio === undefined ? { status: "unheard" } : await listen(dependencies, audio);
  } catch {
    return { status: "unheard" };
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

  const reservation = await reserve(dependencies, { membership, chatId, source: "bot_voice" });

  if (reservation === undefined) {
    await reply(dependencies, { chatId, text: quotaText });

    return;
  }

  await showTyping(dependencies, chatId);

  const heard = await listenToVoice(dependencies, message.voice);

  await sendPreview(dependencies, {
    membership,
    chatId,
    reservation,
    ...(heard.status === "heard"
      ? {
          outcome: await outcomeOf(dependencies, { membership, text: heard.text }),
          heard: heard.text,
        }
      : { outcome: heard }),
  });
}
