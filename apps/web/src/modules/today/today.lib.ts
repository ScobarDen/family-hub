import { type FeedUpcoming, type SlotModule, type TodayTiles } from "@family-hub/contract";

import { formatCount, type CountWords } from "@/common/format-count";
import { formatNearDate, formatShortAge } from "@/common/format-date";
import { sectionTitles } from "@/common/sections";

export type DueRow = {
  key: string;
  module: SlotModule;
  title: string;
  when: string;
  isOverdue: boolean;
  // A birthday comes and goes by itself, so it only opens.
  canComplete: boolean;
  picture: string | undefined;
  // A completed row stays to collapse on screen, and opens up again when the undo is tapped.
  isDone: boolean;
};

export type NextRow = { key: string; title: string; when: string };

export type Tile = {
  module: SlotModule;
  title: string;
  value: string | undefined;
  note: string | undefined;
  isAlert: boolean;
  picture: string | undefined;
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
  task: "tasks",
  birthday: "pet",
};

function whenOf(item: FeedUpcoming, today: string): string {
  const day = formatNearDate(item.date, today);
  const time = item.kind === "task" ? item.time : null;

  return time === null ? day : `${day}, ${time}`;
}

export function dueRowOf(
  item: FeedUpcoming,
  { today, isDone }: { today: string; isDone: boolean },
): DueRow {
  return {
    key: item.key,
    module: moduleOfKind[item.kind],
    title: item.title,
    when: item.date < today ? `Просрочено · ${whenOf(item, today)}` : whenOf(item, today),
    isOverdue: item.date < today,
    canComplete: item.kind === "task",
    picture: item.petPicture ?? undefined,
    isDone,
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
    picture: undefined,
    ...fields,
  };
}

type Tiles = TodayTiles;

function petTile({ activeCount, only }: NonNullable<Tiles["pet"]>, today: string): Tile {
  if (only !== null) {
    return tile("pet", {
      title: only.name,
      value: only.birthDate === null ? undefined : formatShortAge(only.birthDate, today),
      picture: only.picture ?? undefined,
    });
  }

  return activeCount === 0
    ? tile("pet", { title: "Питомцы", note: "Добавить питомца" })
    : tile("pet", { title: "Питомцы", value: String(activeCount) });
}

// A count of zero says nothing, so such a tile shows only its caption.
function counted(count: number): string | undefined {
  return count === 0 ? undefined : String(count);
}

function tasksNoteOf({ overdue, week }: { overdue: number; week: number }): string | undefined {
  if (overdue > 0) {
    return `${overdue} просрочено`;
  }

  return week === 0 ? undefined : `${week} на неделе`;
}

// A section the server could not read keeps its place with only its caption.
const tileOf: {
  [Section in SlotModule]: (read: NonNullable<Tiles[Section]>, today: string) => Tile;
} = {
  tasks: ({ open, overdue, week }) =>
    tile("tasks", {
      value: counted(open),
      note: tasksNoteOf({ overdue, week }),
      isAlert: overdue > 0,
    }),
  pet: (read, today) => petTile(read, today),
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
  recipes: ({ count }) => tile("recipes", { value: counted(count) }),
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
    readOrBare("tasks", tiles.tasks, (read) => tileOf.tasks(read, today)),
    readOrBare("pet", tiles.pet, (read) => tileOf.pet(read, today)),
    readOrBare("goals", tiles.goals, (read) => tileOf.goals(read, today)),
    readOrBare("albums", tiles.albums, (read) => tileOf.albums(read, today)),
    readOrBare("recipes", tiles.recipes, (read) => tileOf.recipes(read, today)),
  ];
}
