import type { Album, AlbumSummary } from "@family-hub/contract";

import { formatDay, type Viewer } from "@/common/format-date.lib.ts";

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

function spanOf({ from, to }: AlbumSummary, viewer: Viewer): string | undefined {
  if (from === null || to === null) {
    return undefined;
  }

  const first = formatDay(from, viewer);
  const last = formatDay(to, viewer);

  return first === last ? first : `${first} — ${last}`;
}

export function subtitleOf(summary: AlbumSummary, viewer: Viewer): string {
  return summary.photoCount === 0
    ? "Пока пусто"
    : [countOf(summary.photoCount), spanOf(summary, viewer)]
        .filter((part) => part !== undefined)
        .join(" · ");
}

// A Pet's Album says so in words: emoji stay in what Members write.
export function toItem(summary: AlbumSummary, viewer: Viewer): AlbumItem {
  const subtitle = subtitleOf(summary, viewer);

  return {
    id: summary.id,
    title: summary.title,
    subtitle: summary.kind === "pet" ? `Альбом питомца · ${subtitle}` : subtitle,
    cover: summary.cover?.thumb,
  };
}
