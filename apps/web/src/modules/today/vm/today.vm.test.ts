import { context, noop, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { FeedUpcoming, Plan, Today } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createTodayApi } from "../today.api.ts";
import { reatomToday, type TodayTarget } from "./today.vm.ts";

const quiet: Today["tiles"] = {
  plans: { open: 0, overdue: 0 },
  calendar: { events: 0 },
  pet: { active: 0, only: null, due: null },
  goals: { nearest: null },
  albums: { photos: 0 },
  recipes: { lastCooked: null },
};

function planDue(index: number, date: string): FeedUpcoming {
  return {
    kind: "plan",
    key: `plan-plan-${index}`,
    title: `Дело ${index}`,
    date,
    planId: `plan-${index}`,
    subplanId: null,
  };
}

const rabies: FeedUpcoming = {
  kind: "due",
  key: "due-entry-1",
  title: "Прививка: Бешенство — Бьюик",
  date: "2026-10-14",
  careKind: "vaccination",
  petId: "pet-1",
  entryId: "entry-1",
};

const chore: Plan = {
  id: "plan-1",
  title: "Дело 1",
  note: null,
  pet: null,
  album: null,
  dueDate: "2026-10-12",
  reminder: null,
  assignee: null,
  visibility: "shared",
  isOwn: true,
  completed: null,
  subplans: [],
};

function startToday(answer: Partial<Today> = {}) {
  const calls: string[] = [];
  const payload: Today = { due: [], next: [], tiles: quiet, ...answer };
  let releaseUndo: () => void = noop;
  const undoOver = new Promise<void>((resolve) => {
    releaseUndo = resolve;
  });
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;

      calls.push(`${init?.method ?? "GET"} ${path}`);

      return Response.json(path === "/api/today" ? payload : chore);
    },
  });
  const opened: Array<TodayTarget | string> = [];
  const model = reatomToday({
    api: createTodayApi(client),
    today: () => "2026-10-16",
    wait: async () => undoOver,
    onOpen: (target) => {
      opened.push(target);
    },
    onOpenSection: (module) => {
      opened.push(`section ${module}`);
    },
    onRecord: (due) => {
      opened.push(`record ${due.entryId} for ${due.petId}`);
    },
    onOpenFeed: () => {
      opened.push("feed");
    },
  });

  // What the View subscribes to, so a reload refetches as it does on screen.
  model.rows.subscribe(noop);

  return { model, calls, opened, releaseUndo };
}

beforeEach(() => {
  context.reset();
});

describe("the header", () => {
  test.each([
    { count: 0, header: "Сегодня свободный день" },
    { count: 2, header: "Сегодня 2 дела" },
    { count: 10, header: "Сегодня 10 дел" },
  ])("says $header for $count items", async ({ count, header }) => {
    const { model } = startToday({
      due: Array.from({ length: count }, (_, index) => planDue(index, "2026-10-16")),
    });

    await vi.waitFor(() => {
      expect(model.header()).toBe(header);
    });
  });
});

describe("«Сделать сегодня»", () => {
  test("shows at most three rows and a «Ещё N» for the rest", async () => {
    const { model } = startToday({
      due: [planDue(1, "2026-10-12"), rabies, planDue(2, "2026-10-16"), planDue(3, "2026-10-16")],
    });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(3);
    });
    expect(model.rows()).toEqual([
      expect.objectContaining({ title: "Дело 1", when: "12 октября", isOverdue: true }),
      expect.objectContaining({
        title: "Прививка: Бешенство — Бьюик",
        action: { kind: "record", title: "Отметить прививку" },
      }),
      expect.objectContaining({
        title: "Дело 2",
        when: "Сегодня",
        isOverdue: false,
        action: { kind: "complete", title: "Готово" },
      }),
    ]);
    expect(model.more()).toBe(1);
  });

  test("opens the Feed from «Ещё N»", async () => {
    const { model, opened } = startToday();

    model.openFeed();

    expect(opened).toEqual(["feed"]);
  });

  test("completes a Plan with one tap once the undo window has passed, then refreshes", async () => {
    const { model, calls, releaseUndo } = startToday({ due: [planDue(1, "2026-10-12")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.act("plan-plan-1");

    expect(model.rows()).toEqual([]);
    expect(model.header()).toBe("Сегодня свободный день");
    expect(model.undo()).toEqual({ title: "Дело 1" });
    expect(calls).toEqual(["GET /api/today"]);

    releaseUndo();

    await vi.waitFor(() => {
      expect(calls).toEqual([
        "GET /api/today",
        "POST /api/plans/plan-1/complete",
        "GET /api/today",
      ]);
    });
    expect(model.undo()).toBeUndefined();
  });

  test("puts the Plan back untouched when the undo is tapped", async () => {
    const { model, calls, releaseUndo } = startToday({ due: [planDue(1, "2026-10-12")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.act("plan-plan-1");
    model.revert();
    releaseUndo();
    await sleep(0);

    expect(model.rows()).toHaveLength(1);
    expect(model.undo()).toBeUndefined();
    expect(calls).toEqual(["GET /api/today"]);
  });

  test("sends a pending completion at once when the next Plan is completed", async () => {
    const { model, calls } = startToday({
      due: [planDue(1, "2026-10-12"), planDue(2, "2026-10-13")],
    });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(2);
    });
    model.act("plan-plan-1");
    model.act("plan-plan-2");

    expect(model.undo()).toEqual({ title: "Дело 2" });
    await vi.waitFor(() => {
      expect(calls).toContain("POST /api/plans/plan-1/complete");
    });
    expect(calls).not.toContain("POST /api/plans/plan-2/complete");
  });

  test("opens a Due Date's Care Entry form for its Pet", async () => {
    const { model, opened, calls } = startToday({ due: [rabies] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.act("due-entry-1");

    expect(opened).toEqual(["record entry-1 for pet-1"]);
    expect(calls).toEqual(["GET /api/today"]);
  });
});

describe("«Дальше»", () => {
  test("shows the day and the time of each Upcoming", async () => {
    const { model, opened } = startToday({
      next: [
        {
          kind: "event",
          key: "event-1-2026-10-16",
          title: "Созвон",
          date: "2026-10-16",
          time: "19:00",
          eventId: "event-1",
        },
        planDue(4, "2026-10-17"),
      ],
    });

    await vi.waitFor(() => {
      expect(model.next()).toEqual([
        { key: "event-1-2026-10-16", title: "Созвон", when: "Сегодня, 19:00" },
        { key: "plan-plan-4", title: "Дело 4", when: "Завтра" },
      ]);
    });
    model.openItem("event-1-2026-10-16");

    expect(opened).toEqual([{ kind: "event", eventId: "event-1" }]);
  });
});

describe("the section tiles", () => {
  test("keep all six sections in a fixed order, with only the caption when nothing counts", async () => {
    const { model } = startToday();

    await vi.waitFor(() => {
      expect(model.tiles()).toHaveLength(6);
    });
    expect(model.tiles()).toEqual([
      { module: "plans", title: "Планы", value: undefined, note: undefined, isAlert: false },
      { module: "calendar", title: "Календарь", value: undefined, note: undefined, isAlert: false },
      {
        module: "pet",
        title: "Питомцы",
        value: undefined,
        note: "Добавить питомца",
        isAlert: false,
      },
      { module: "goals", title: "Цели", value: undefined, note: undefined, isAlert: false },
      { module: "albums", title: "Альбомы", value: undefined, note: undefined, isAlert: false },
      { module: "recipes", title: "Рецепты", value: undefined, note: undefined, isAlert: false },
    ]);
  });

  test("show live numbers with the Overdue Plans in red", async () => {
    const { model } = startToday({
      tiles: {
        plans: { open: 5, overdue: 2 },
        calendar: { events: 3 },
        pet: {
          active: 2,
          only: null,
          due: { label: "Прививка: Нобивак — Мурка", date: "2026-10-20" },
        },
        goals: { nearest: { goalId: "goal-1", title: "Диван", percent: 25 } },
        albums: { photos: 4 },
        recipes: { lastCooked: { recipeId: "recipe-1", title: "Борщ" } },
      },
    });

    await vi.waitFor(() => {
      expect(model.tiles()[0]?.value).toBe("5");
    });
    expect(model.tiles()).toEqual([
      { module: "plans", title: "Планы", value: "5", note: "2 просрочено", isAlert: true },
      { module: "calendar", title: "Календарь", value: "3", note: "на неделе", isAlert: false },
      {
        module: "pet",
        title: "Питомцы · 2",
        value: undefined,
        note: "Прививка: Нобивак — Мурка · 20 октября",
        isAlert: false,
      },
      { module: "goals", title: "Цели", value: "25%", note: "Диван", isAlert: false },
      { module: "albums", title: "Альбомы", value: "4", note: "фото за неделю", isAlert: false },
      { module: "recipes", title: "Рецепты", value: undefined, note: "Борщ", isAlert: false },
    ]);
  });

  test.each([
    {
      pet: { active: 1, only: { petId: "pet-1", name: "Бьюик" }, due: null },
      opened: { kind: "pet", petId: "pet-1" },
    },
    { pet: { active: 0, only: null, due: null }, opened: { kind: "add-pet" } },
    { pet: { active: 2, only: null, due: null }, opened: "section pet" },
  ])("open the Pets tile for $pet.active active Pets", async ({ pet, opened: target }) => {
    const { model, opened } = startToday({ tiles: { ...quiet, pet } });

    await vi.waitFor(() => {
      expect(model.tiles()).toHaveLength(6);
    });
    model.openTile("pet");

    expect(opened).toEqual([target]);
  });
});
