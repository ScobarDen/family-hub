import type { Message } from "@grammyjs/types";

import type { FeedUpcoming } from "@family-hub/contract";
import { dateInZone, daysAfter, occurrenceMoment } from "@family-hub/recurrence";

import { fallbackTimeZone } from "@/common/clock.lib.ts";
import { ignoringBotErrors, strangerText } from "@/modules/telegram";

import { formatFloatingDate, openAppButton, snoozeMs, sourceIdOf } from "../reminder.lib.ts";
import type { SourceHolder, ReminderDependencies, Source } from "../reminder.types.ts";
import type { DigestRow } from "../repo/source.repo.ts";

// Telegram takes at most 4096 characters a message; a long list ends with how much is left out.
const linesPerBlockMax = 10;
const titleMaxLength = 120;

function shortened(title: string): string {
  return title.length > titleMaxLength ? `${title.slice(0, titleMaxLength - 1)}…` : title;
}

function lineOf(item: FeedUpcoming, { isOverdue }: { isOverdue: boolean }): string {
  const title = shortened(item.title);

  if (isOverdue) {
    return `• ${title} · ${formatFloatingDate(item.date)}`;
  }

  const time = "time" in item ? item.time : null;

  return time === null ? `• ${title}` : `• ${time} ${title}`;
}

function blockOf(
  heading: string,
  items: FeedUpcoming[],
  options: { isOverdue: boolean },
): string | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const shown = items.slice(0, linesPerBlockMax).map((item) => lineOf(item, options));
  const rest = items.length - shown.length;

  return [heading, ...shown, ...(rest > 0 ? [`…и ещё ${rest}`] : [])].join("\n");
}

function headingOf(day: string): string {
  return `Сводка на ${formatFloatingDate(day)}`;
}

// Only what this Member sees, and nothing at all on a day with nothing to say.
function digestBody({
  overdue,
  today,
}: {
  overdue: FeedUpcoming[];
  today: FeedUpcoming[];
}): string | undefined {
  if (overdue.length === 0 && today.length === 0) {
    return undefined;
  }

  const blocks = [
    blockOf("⚠️ Просрочено", overdue, { isOverdue: true }),
    blockOf("📅 Сегодня", today, { isOverdue: false }),
  ];

  return blocks.filter((block) => block !== undefined).join("\n\n");
}

// One digest a day per Member, at the time they chose on their own clock.
async function digestSource(
  dependencies: ReminderDependencies,
  { memberId, settings }: { memberId: string; settings: DigestRow },
): Promise<Source> {
  const appUrl = await dependencies.appLinks.appLink();

  return {
    kind: "digest",
    sourceId: sourceIdOf(memberId),
    recipientIds: [memberId],
    homeZone: undefined,
    first: (day) => day,
    next: (occurrence) => daysAfter(occurrence, 1),
    fireAt: (occurrence, timeZone) =>
      occurrenceMoment(occurrence, { time: settings.digestTime, timeZone }),
    emoji: "☀️",
    title: headingOf,
    buttons: () => openAppButton({ text: "Открыть ленту", url: appUrl }),
    compose: async () => {
      const content = await dependencies.digests.contentOf(memberId);

      return content && digestBody(content);
    },
    closesForEveryone: false,
    snoozeMs,
    isSkippedWhenLate: true,
  };
}

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
  const body = (content && digestBody(content)) ?? "На сегодня ничего нет";
  const text = `☀️ ${headingOf(day)}\n\n${body}`;

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

// A Member who turned the digest off, or is no longer in the Family, has no digest to send.
export async function digestSources(
  dependencies: ReminderDependencies,
  { familyId, id: memberId }: SourceHolder,
): Promise<Source[]> {
  const membership = await dependencies.memberships.findByMemberId(memberId);
  const settings = await dependencies.sources.digestOf(memberId);

  return membership?.family.id !== familyId || settings?.isDigestEnabled !== true
    ? []
    : [await digestSource(dependencies, { memberId, settings })];
}
