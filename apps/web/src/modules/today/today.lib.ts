import type { FeedUpcoming, SlotModule, TodayTiles } from "@family-hub/contract";

import { formatCount, type CountWords } from "@/common/format-count";
import { formatNearDate } from "@/common/format-date";
import { sectionTitles } from "@/common/sections";

export type DueRow = {
  key: string;
  module: SlotModule;
  title: string;
  when: string;
  isOverdue: boolean;
  action: { kind: "complete" | "record"; title: string };
};

export type NextRow = { key: string; title: string; when: string };

export type Tile = {
  module: SlotModule;
  title: string;
  value: string | undefined;
  note: string | undefined;
  isAlert: boolean;
};

const choreWords: CountWords = {
  one: "дело",
  few: "дела",
  many: "дел",
  other: "дела",
};

const recordTitles = {
  vaccination: "Отметить прививку",
  treatment: "Отметить обработку",
  vet_visit: "Отметить визит",
} as const;

export function headerOf(count: number): string {
  return count === 0 ? "Сегодня свободный день" : `Сегодня ${formatCount(count, choreWords)}`;
}

export function dueRowOf(item: FeedUpcoming, today: string): DueRow {
  return {
    key: item.key,
    module: item.kind === "due" ? "pet" : "plans",
    title: item.title,
    when: formatNearDate(item.date, today),
    isOverdue: item.date < today,
    action:
      item.kind === "due"
        ? { kind: "record", title: recordTitles[item.careKind] }
        : { kind: "complete", title: "Готово" },
  };
}

export function nextRowOf(item: FeedUpcoming, today: string): NextRow {
  const day = formatNearDate(item.date, today);
  const time = "time" in item ? item.time : null;

  return { key: item.key, title: item.title, when: time === null ? day : `${day}, ${time}` };
}

function tile(module: SlotModule, fields: Partial<Omit<Tile, "module">> = {}): Tile {
  return {
    module,
    title: sectionTitles[module],
    value: undefined,
    note: undefined,
    isAlert: false,
    ...fields,
  };
}

function petTile({ active, only, due }: TodayTiles["pet"], today: string): Tile {
  const note = due === null ? undefined : `${due.label} · ${formatNearDate(due.date, today)}`;
  const isAlert = due !== null && due.date < today;

  if (only !== null) {
    return tile("pet", { title: only.name, note, isAlert });
  }

  return active === 0
    ? tile("pet", { title: "Питомцы", note: "Добавить питомца" })
    : tile("pet", { title: `Питомцы · ${active}`, note, isAlert });
}

// A count of zero says nothing, so such a tile shows only its caption.
function counted(count: number): string | undefined {
  return count === 0 ? undefined : String(count);
}

export function tilesOf(tiles: TodayTiles, today: string): Tile[] {
  const { plans, calendar, goals, albums, recipes } = tiles;

  return [
    tile("plans", {
      value: counted(plans.open),
      note: plans.overdue === 0 ? undefined : `${plans.overdue} просрочено`,
      isAlert: plans.overdue > 0,
    }),
    tile("calendar", {
      value: counted(calendar.events),
      note: calendar.events === 0 ? undefined : "на неделе",
    }),
    petTile(tiles.pet, today),
    tile("goals", {
      value: goals.nearest === null ? undefined : `${goals.nearest.percent}%`,
      note: goals.nearest?.title,
    }),
    tile("albums", {
      value: counted(albums.photos),
      note: albums.photos === 0 ? undefined : "фото за неделю",
    }),
    tile("recipes", { note: recipes.lastCooked?.title }),
  ];
}

export function statusOf({ value, note }: Tile): string | undefined {
  const parts = [value, note].filter((part) => part !== undefined);

  return parts.length === 0 ? undefined : parts.join(" · ");
}
