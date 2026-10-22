import type { Album, AlbumSummary } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";

export type AlbumItem = {
  id: string;
  title: string;
  subtitle: string;
  cover: string | undefined;
};

export type AlbumView = Album & { subtitle: string };

// «фото» does not change with the count.
function countOf(count: number): string {
  return `${count} фото`;
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
