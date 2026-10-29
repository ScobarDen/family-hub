import type { FeedActivity, FeedUpcoming, Photo } from "@family-hub/contract";
import { dateInZone, timeInZone } from "@family-hub/recurrence";

import { formatNearDate } from "@/common/format-date.lib.ts";

export type FeedFilter = "all" | "tasks" | "pet" | "goals" | "albums";

export type FeedItem = FeedUpcoming | FeedActivity;

export type FeedRow = {
  key: string;
  kind: FeedItem["kind"] | "done";
  title: string;
  subtitle: string | undefined;
  isOverdue: boolean;
  canComplete: boolean;
  photos: Photo[];
  morePhotos: number;
  author: { name: string; profilePicture: string | null } | undefined;
  picture: string | undefined;
};

export type FeedBlock = { title: string; rows: FeedRow[] };

export type FeedData = {
  overdue: FeedUpcoming[];
  upcoming: FeedUpcoming[];
  activity: FeedActivity[];
};

type Viewer = { today: string; timeZone: string };

const modules: Record<FeedItem["kind"], FeedFilter> = {
  task: "tasks",
  birthday: "pet",
  care: "pet",
  goal: "goals",
  upload: "albums",
  joined: "all",
};

export function isShownBy(item: FeedItem, filter: FeedFilter): boolean {
  return filter === "all" || modules[item.kind] === filter;
}

function aheadRow(item: FeedUpcoming, isOverdue: boolean, { today }: Viewer): FeedRow {
  const time = item.kind === "task" ? item.time : null;
  const when = [formatNearDate(item.date, today), time].filter((part) => part !== null).join(", ");

  return {
    key: item.key,
    kind: item.kind,
    title: item.title,
    subtitle: isOverdue ? `Просрочено · ${when}` : when,
    isOverdue,
    canComplete: item.kind === "task",
    photos: [],
    morePhotos: 0,
    author: undefined,
    picture: item.petPicture ?? undefined,
  };
}

function titleOf(item: FeedActivity): string {
  if (item.kind === "joined") {
    return `${item.memberName} теперь в семье`;
  }

  return item.kind === "upload"
    ? `${item.memberName} добавил(а) ${item.photoCount} фото в «${item.albumTitle}»`
    : item.title;
}

function photosOf(item: FeedActivity): Pick<FeedRow, "photos" | "morePhotos"> {
  return item.kind === "care" || item.kind === "upload"
    ? { photos: item.photos, morePhotos: item.photoCount - item.photos.length }
    : { photos: [], morePhotos: 0 };
}

function activityRow(item: FeedActivity, timeZone: string): FeedRow {
  const time = timeInZone(item.at, timeZone);

  return {
    key: item.key,
    kind: item.kind === "task" ? "done" : item.kind,
    title: titleOf(item),
    subtitle:
      item.kind === "joined" || item.kind === "upload" ? time : `${item.memberName} · ${time}`,
    isOverdue: false,
    canComplete: false,
    ...photosOf(item),
    author: { name: item.memberName, profilePicture: item.memberPicture },
    picture: undefined,
  };
}

// Activity comes newest first, so each day's rows already follow one another.
function activityBlocks(activity: FeedActivity[], viewer: Viewer): FeedBlock[] {
  const blocks: FeedBlock[] = [];

  for (const item of activity) {
    const title = formatNearDate(dateInZone(item.at, viewer.timeZone), viewer.today);
    const last = blocks.at(-1);
    const row = activityRow(item, viewer.timeZone);

    if (last?.title === title) {
      last.rows.push(row);
    } else {
      blocks.push({ title, rows: [row] });
    }
  }

  return blocks;
}

export function summaryOf(
  { overdue, upcoming }: Pick<FeedData, "overdue" | "upcoming">,
  today: string,
): string {
  const dueToday = upcoming.filter((item) => item.date === today).length;
  const parts = [
    overdue.length > 0 ? `Просрочено: ${overdue.length}` : undefined,
    dueToday > 0 ? `Сегодня: ${dueToday}` : undefined,
  ].filter((part) => part !== undefined);

  return parts.length === 0 ? "На сегодня ничего не запланировано" : parts.join(" · ");
}

export function blocksOf(
  data: FeedData,
  { filter, viewer }: { filter: FeedFilter; viewer: Viewer },
): FeedBlock[] {
  function shown<Item extends FeedItem>(items: Item[]): Item[] {
    return items.filter((item) => isShownBy(item, filter));
  }

  return [
    { title: "Просрочено", rows: shown(data.overdue).map((item) => aheadRow(item, true, viewer)) },
    { title: "Предстоит", rows: shown(data.upcoming).map((item) => aheadRow(item, false, viewer)) },
    ...activityBlocks(shown(data.activity), viewer),
  ].filter(({ rows }) => rows.length > 0);
}
