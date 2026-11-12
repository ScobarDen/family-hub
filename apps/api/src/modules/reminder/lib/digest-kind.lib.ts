import type { FeedUpcoming } from "@family-hub/contract";
import { daysAfter, occurrenceMoment } from "@family-hub/recurrence";

import type { ReminderKind, ReminderSource } from "../reminder.types.ts";
import { formatFloatingDate, openAppButton, snoozeMs, sourceIdOf } from "./reminder.lib.ts";

export type DigestFeed = { overdue: FeedUpcoming[]; today: FeedUpcoming[] };

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

export function digestHeadingOf(day: string): string {
  return `Сводка на ${formatFloatingDate(day)}`;
}

// Only what this Member sees, and nothing at all on a day with nothing to say.
export function digestBodyOf({ overdue, today }: DigestFeed): string | undefined {
  if (overdue.length === 0 && today.length === 0) {
    return undefined;
  }

  const blocks = [
    blockOf("⚠️ Просрочено", overdue, { isOverdue: true }),
    blockOf("📅 Сегодня", today, { isOverdue: false }),
  ];

  return blocks.filter((block) => block !== undefined).join("\n\n");
}

type DigestSourcing = {
  memberId: string;
  digestTime: string;
  appUrl: string;
  contentOf: () => Promise<DigestFeed | undefined>;
};

function digestKind({ appUrl, contentOf }: DigestSourcing): ReminderKind {
  return {
    emoji: "☀️",
    title: digestHeadingOf,
    pushText: (occurrence, { body }) => ({ title: digestHeadingOf(occurrence), body: body ?? "" }),
    buttons: () => openAppButton({ text: "Открыть ленту", url: appUrl }),
    deepLink: undefined,
    closing: { by: "none" },
    snoozeMs,
    content: async () => {
      const feed = await contentOf();
      const body = feed && digestBodyOf(feed);

      return body === undefined ? { status: "nothing-to-say" } : { status: "body", body };
    },
  };
}

// One Digest a day per Member, at the time they chose on their own clock; it offers no «Готово».
export function digestSource(sourcing: DigestSourcing): ReminderSource {
  const { memberId, digestTime } = sourcing;

  return {
    schedule: {
      kind: "digest",
      sourceId: sourceIdOf(memberId),
      recipientIds: [memberId],
      homeZone: undefined,
      first: (day) => day,
      next: (occurrence) => daysAfter(occurrence, 1),
      fireAt: (occurrence, timeZone) =>
        occurrenceMoment(occurrence, { time: digestTime, timeZone }),
    },
    kind: digestKind(sourcing),
  };
}
