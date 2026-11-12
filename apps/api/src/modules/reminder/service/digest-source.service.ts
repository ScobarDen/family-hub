import type { Message } from "@grammyjs/types";

import { dateInZone } from "@family-hub/recurrence";

import { fallbackTimeZone } from "@/common/clock.lib.ts";
import { ignoringBotErrors, strangerText } from "@/modules/telegram";

import { digestBodyOf, digestHeadingOf, digestSource } from "../lib/digest-kind.lib.ts";
import { openAppButton } from "../lib/reminder.lib.ts";
import type { ReminderDependencies, ReminderSource, SourceHolder } from "../reminder.types.ts";

// /today answers even on an empty day, since the Member asked.
export async function sendToday(
  dependencies: ReminderDependencies,
  message: Message,
): Promise<void> {
  const { bot, memberships, clock } = dependencies;
  const chatId = message.chat.id;
  const membership = message.from && (await memberships.findByTelegramId(message.from.id));

  if (membership === undefined) {
    await ignoringBotErrors(bot.call("sendMessage", { chat_id: chatId, text: strangerText }));

    return;
  }

  const day = dateInZone(clock.now(), membership.member.timeZone ?? fallbackTimeZone);
  const content = await dependencies.digests.contentOf(membership.member.id);
  const body = (content && digestBodyOf(content)) ?? "На сегодня ничего нет";
  const text = `☀️ ${digestHeadingOf(day)}\n\n${body}`;

  await ignoringBotErrors(
    bot.call("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: openAppButton({
        text: "Открыть ленту",
        url: await dependencies.appLinks.appLink(),
      }),
    }),
  );
}

// A Member who turned the Digest off, or is no longer in the Family, has no Digest to send.
export async function digestSources(
  dependencies: ReminderDependencies,
  { familyId, id: memberId }: SourceHolder,
): Promise<ReminderSource[]> {
  const membership = await dependencies.memberships.findByMemberId(memberId);
  const settings = await dependencies.sources.digestOf(memberId);

  if (membership?.family.id !== familyId || settings?.isDigestEnabled !== true) {
    return [];
  }

  return [
    digestSource({
      memberId,
      digestTime: settings.digestTime,
      appUrl: await dependencies.appLinks.appLink(),
      contentOf: async () => dependencies.digests.contentOf(memberId),
    }),
  ];
}
