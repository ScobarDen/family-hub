import type { ReminderOffset } from "@family-hub/contract";

// The Task form shows the same words as chips, capitalised.
export const offsetTitles: Record<ReminderOffset, string> = {
  "at-start": "в момент",
  "15m": "за 15 минут",
  "1h": "за час",
  "1d": "за день",
  "1w": "за неделю",
};

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value.replaceAll(".", "") ?? "";
}

// «пт 16 окт», without Intl's commas and dots; a floating date reads the same in every zone.
export function dayOf(date: string): string {
  const parts = dayFormat.formatToParts(new Date(`${date}T12:00:00Z`));

  return `${partOf(parts, "weekday")} ${partOf(parts, "day")} ${partOf(parts, "month")}`;
}

export function momentOf({ date, time }: { date: string | null; time: string | null }): string {
  return [date === null ? undefined : dayOf(date), time ?? undefined]
    .filter((part) => part !== undefined)
    .join(", ");
}

export function rublesOf(amount: number): string {
  return rubles.format(amount);
}
