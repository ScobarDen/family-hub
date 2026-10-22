import type { FeedUpcoming } from "@family-hub/contract";
import { dayAfter, occurrenceMoment } from "@family-hub/recurrence";

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
