import { type FeedUpcoming, type SlotModule, type TodayTiles } from "@family-hub/contract";

import { formatCount, type CountWords } from "@/common/format-count";
import { formatNearDate } from "@/common/format-date";
import { sectionTitles } from "@/common/sections";

export type DueRow = {
  key: string;
  module: SlotModule;
  title: string;
  when: string;
  isOverdue: boolean;
  // Events, Reminders and birthdays come and go by themselves, so they only open.
  action: { kind: "complete" | "record"; title: string } | undefined;
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

export function headerOf(count: number): string {
  return count === 0 ? "День свободен" : formatCount(count, choreWords);
}

export function moreOf(rest: number): string | undefined {
  return rest > 0 ? `Ещё ${formatCount(rest, choreWords)}` : undefined;
}

const moduleOfKind: Record<FeedUpcoming["kind"], SlotModule> = {
  plan: "plans",
  due: "pet",
  birthday: "pet",
  event: "calendar",
  reminder: "calendar",
};

function actionOf({ kind }: FeedUpcoming): DueRow["action"] {
  if (kind === "plan") {
    return { kind: "complete", title: "Отметить выполненным" };
  }

  return kind === "due" ? { kind: "record", title: "Записать" } : undefined;
}

function whenOf(item: FeedUpcoming, today: string): string {
  const day = formatNearDate(item.date, today);
  const time = "time" in item ? item.time : null;

  return time === null ? day : `${day}, ${time}`;
}

export function dueRowOf(item: FeedUpcoming, today: string): DueRow {
  return {
    key: item.key,
    module: moduleOfKind[item.kind],
    title: item.title,
    when: item.date < today ? `Просрочено · ${whenOf(item, today)}` : whenOf(item, today),
    isOverdue: item.date < today,
    action: actionOf(item),
  };
}

export function nextRowOf(item: FeedUpcoming, today: string): NextRow {
  return { key: item.key, title: item.title, when: whenOf(item, today) };
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

type Tiles = TodayTiles;

function petTile(pet: NonNullable<Tiles["pet"]>, today: string): Tile {
  const { activeCount, only, due } = pet;
  const isAlert = due !== null && due.date < today;
  const note =
    due === null
      ? undefined
      : `${isAlert ? "Просрочено · " : ""}${due.label} · ${formatNearDate(due.date, today)}`;

  if (only !== null) {
    return tile("pet", { title: only.name, note, isAlert });
  }

  return activeCount === 0
    ? tile("pet", { title: "Питомцы", note: "Добавить питомца" })
    : tile("pet", { title: "Питомцы", value: String(activeCount), note, isAlert });
}

// A count of zero says nothing, so such a tile shows only its caption.
function counted(count: number): string | undefined {
  return count === 0 ? undefined : String(count);
}

// A section the server could not read keeps its place with only its caption.
const tileOf: {
  [Section in SlotModule]: (read: NonNullable<Tiles[Section]>, today: string) => Tile;
} = {
  plans: ({ open, overdue }) =>
    tile("plans", {
      value: counted(open),
      note: overdue === 0 ? undefined : `${overdue} просрочено`,
      isAlert: overdue > 0,
    }),
  calendar: ({ events }) =>
    tile("calendar", { value: counted(events), note: events === 0 ? undefined : "на неделе" }),
  pet: petTile,
  goals: ({ nearest }) =>
    tile("goals", {
      value: nearest === null ? undefined : `${nearest.percent}%`,
      note: nearest?.title,
    }),
  albums: ({ photos }) =>
    tile("albums", {
      value: counted(photos),
      note: photos === 0 ? undefined : "фото за неделю",
    }),
  recipes: ({ lastCooked }) => tile("recipes", { note: lastCooked?.title }),
};

function readOrBare<Read>(
  section: SlotModule,
  read: Read | null,
  make: (read: Read) => Tile,
): Tile {
  return read === null ? tile(section) : make(read);
}

export function tilesOf(tiles: Tiles, today: string): Tile[] {
  return [
    readOrBare("plans", tiles.plans, (read) => tileOf.plans(read, today)),
    readOrBare("calendar", tiles.calendar, (read) => tileOf.calendar(read, today)),
    readOrBare("pet", tiles.pet, (read) => tileOf.pet(read, today)),
    readOrBare("goals", tiles.goals, (read) => tileOf.goals(read, today)),
    readOrBare("albums", tiles.albums, (read) => tileOf.albums(read, today)),
    readOrBare("recipes", tiles.recipes, (read) => tileOf.recipes(read, today)),
  ];
}
