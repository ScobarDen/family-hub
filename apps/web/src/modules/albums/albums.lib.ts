import type { Album, AlbumSummary } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";

export type AlbumItem = {
  id: string;
  title: string;
  subtitle: string;
  cover: string | undefined;
};

export type AlbumView = Album & { subtitle: string };

const plural = new Intl.PluralRules("ru-RU");
const photoWords = { one: "фото", few: "фото", many: "фото", other: "фото" } as const;

function countOf(count: number): string {
  const form = plural.select(count);

  return `${count} ${form === "zero" || form === "two" ? photoWords.other : photoWords[form]}`;
}

function spanOf({ from, to }: AlbumSummary, timeZone: string): string | undefined {
  if (from === null || to === null) {
    return undefined;
  }

  const first = formatDay(from, timeZone);
  const last = formatDay(to, timeZone);

  return first === last ? first : `${first} — ${last}`;
}

export function subtitleOf(summary: AlbumSummary, timeZone: string): string {
  return summary.photoCount === 0
    ? "Пока пусто"
    : [countOf(summary.photoCount), spanOf(summary, timeZone)]
        .filter((part) => part !== undefined)
        .join(" · ");
}

export function toItem(summary: AlbumSummary, timeZone: string): AlbumItem {
  return {
    id: summary.id,
    title: summary.kind === "pet" ? `🐾 ${summary.title}` : summary.title,
    subtitle: subtitleOf(summary, timeZone),
    cover: summary.cover?.thumb,
  };
}
