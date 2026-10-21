import type { FeedActivity, FeedUpcoming } from "@family-hub/contract";
import { dateInZone, dayBefore, timeInZone } from "@family-hub/recurrence";

import { formatDate } from "@/common/format-date";

export type FeedFilter = "all" | "plans" | "calendar" | "pet" | "goals";

export type FeedItem = FeedUpcoming | FeedActivity;

export type FeedRow = {
  key: string;
  kind: FeedItem["kind"] | "done";
  title: string;
  subtitle: string | undefined;
  isOverdue: boolean;
  canComplete: boolean;
  canRecord: boolean;
};

export type FeedBlock = { title: string; rows: FeedRow[] };

export type FeedData = {
  overdue: FeedUpcoming[];
  upcoming: FeedUpcoming[];
  activity: FeedActivity[];
};

type Viewer = { today: string; timeZone: string };

const modules: Record<FeedItem["kind"], FeedFilter> = {
  event: "calendar",
  reminder: "calendar",
  plan: "plans",
  due: "pet",
  birthday: "pet",
  care: "pet",
  goal: "goals",
  joined: "all",
};

export function isShownBy(item: FeedItem, filter: FeedFilter): boolean {
  return filter === "all" || modules[item.kind] === filter;
}

function aheadRow(item: FeedUpcoming, isOverdue: boolean): FeedRow {
  const time = "time" in item ? item.time : null;

  return {
    key: item.key,
    kind: item.kind,
    title: item.title,
    subtitle: [formatDate(item.date), time].filter((part) => part !== null).join(", "),
    isOverdue,
    canComplete: item.kind === "plan",
    canRecord: item.kind === "due",
  };
}

function activityRow(item: FeedActivity, timeZone: string): FeedRow {
  const time = timeInZone(item.at, timeZone);

  return {
    key: item.key,
    kind: item.kind === "plan" ? "done" : item.kind,
    title: item.kind === "joined" ? `${item.memberName} теперь в семье` : item.title,
    subtitle: item.kind === "joined" ? time : `${item.memberName} · ${time}`,
    isOverdue: false,
    canComplete: false,
    canRecord: false,
  };
}

function dayTitle(date: string, { today }: Viewer): string {
  if (date === today) {
    return "Сегодня";
  }

  return date === dayBefore(today) ? "Вчера" : formatDate(date);
}

// Activity comes newest first, so each day's rows already follow one another.
function activityBlocks(activity: FeedActivity[], viewer: Viewer): FeedBlock[] {
  const blocks: FeedBlock[] = [];

  for (const item of activity) {
    const title = dayTitle(dateInZone(item.at, viewer.timeZone), viewer);
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

export function blocksOf(
  data: FeedData,
  { filter, viewer }: { filter: FeedFilter; viewer: Viewer },
): FeedBlock[] {
  function shown<Item extends FeedItem>(items: Item[]): Item[] {
    return items.filter((item) => isShownBy(item, filter));
  }

  return [
    { title: "Просрочено", rows: shown(data.overdue).map((item) => aheadRow(item, true)) },
    { title: "Предстоит", rows: shown(data.upcoming).map((item) => aheadRow(item, false)) },
    ...activityBlocks(shown(data.activity), viewer),
  ].filter(({ rows }) => rows.length > 0);
}
