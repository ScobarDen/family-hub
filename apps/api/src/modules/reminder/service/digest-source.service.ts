import type { FeedUpcoming } from "@family-hub/contract";
import { dayAfter, occurrenceMoment } from "@family-hub/recurrence";

import { formatFloatingDate, openAppButton, snoozeMs } from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DigestRow } from "../repo/source.repo.ts";

function lineOf(item: FeedUpcoming, { isOverdue }: { isOverdue: boolean }): string {
  if (isOverdue) {
    return `• ${item.title} · ${formatFloatingDate(item.date)}`;
  }

  const time = "time" in item ? item.time : null;

  return time === null ? `• ${item.title}` : `• ${time} ${item.title}`;
}

// Only what this Member sees, and nothing at all on a day with nothing to say.
export function digestText(
  { overdue, today }: { overdue: FeedUpcoming[]; today: FeedUpcoming[] },
  day: string,
): string | undefined {
  if (overdue.length === 0 && today.length === 0) {
    return undefined;
  }

  const blocks = [
    `☀️ Сводка на ${formatFloatingDate(day)}`,
    overdue.length === 0
      ? undefined
      : ["⚠️ Просрочено", ...overdue.map((item) => lineOf(item, { isOverdue: true }))].join("\n"),
    today.length === 0
      ? undefined
      : ["📅 Сегодня", ...today.map((item) => lineOf(item, { isOverdue: false }))].join("\n"),
  ];

  return blocks.filter((block) => block !== undefined).join("\n\n");
}

async function appUrlOf({ bot }: ReminderDependencies): Promise<string> {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- BotApi.call always takes params; getMe has none
  const { username } = await bot.call("getMe", undefined);

  return `https://t.me/${username}?startapp`;
}

// One digest a day per Member, at the time they chose on their own clock.
export async function digestSource(
  dependencies: ReminderDependencies,
  { memberId, familyId, settings }: { memberId: string; familyId: string; settings: DigestRow },
): Promise<Source> {
  const appUrl = await appUrlOf(dependencies);

  return {
    kind: "digest",
    familyId,
    sourceId: memberId,
    recipientIds: [memberId],
    homeZone: undefined,
    first: (day) => day,
    next: dayAfter,
    fireAt: (occurrence, timeZone) =>
      occurrenceMoment(occurrence, { time: settings.digestTime, timeZone }),
    emoji: "☀️",
    title: (occurrence) => `Сводка на ${formatFloatingDate(occurrence)}`,
    buttons: () => openAppButton({ text: "Открыть ленту", url: appUrl }),
    compose: async (occurrence) => {
      const content = await dependencies.digests.contentOf(memberId);

      return content && digestText(content, occurrence);
    },
    closesForEveryone: false,
    snoozeMs,
    isSkippedWhenLate: true,
  };
}
