import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { FeedUpcoming, Plan, Subplan, Today } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createTodayApi } from "../today.api.ts";
import { reatomToday, type TodayTarget } from "./today.vm.ts";

const quiet: Today["tiles"] = {
  plans: { open: 0, overdue: 0 },
  calendar: { events: 0 },
  pet: { activeCount: 0, only: null, due: null },
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

const completedAt = Date.parse("2026-10-16T07:00:00Z");

const blankSubplan: Subplan = {
  id: "sub",
  title: "",
  dueDate: null,
  reminder: null,
  assignee: null,
  completed: null,
};

// Completing a Plan closes its open Subplans at the same moment; one was closed days before.
const completedChore: Plan = {
  ...chore,
  completed: { at: completedAt, by: "Денис" },
  subplans: [
    { ...blankSubplan, id: "sub-a", title: "Купить", completed: { at: completedAt, by: "Денис" } },
    {
      ...blankSubplan,
      id: "sub-b",
      title: "Позвонить",
      completed: { at: completedAt - 86_400_000, by: "Ася" },
    },
  ],
};

function answerOf(
  path: string,
  { payload, failing }: { payload: Today; failing: string | undefined },
) {
  if (path === failing) {
    return Response.json({ code: "internal", message: "D1 is down" }, { status: 500 });
  }

  return Response.json(path === "/api/today" ? payload : completedChore);
}

function startToday(answer: Partial<Today> = {}, { failing }: { failing?: string } = {}) {
  const calls: string[] = [];
  const payload: Today = { due: [], next: [], tiles: quiet, ...answer };
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;

      calls.push(`${init?.method ?? "GET"} ${path}`);

      return answerOf(path, { payload, failing });
    },
  });
  const opened: Array<TodayTarget | string> = [];
  const model = reatomToday({
    api: createTodayApi(client),
    today: () => "2026-10-16",
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

  return { model, calls, opened };
}

beforeEach(() => {
  context.reset();
});

describe("the header", () => {
  test.each([
    { count: 0, header: "День свободен" },
    { count: 2, header: "2 дела" },
    { count: 10, header: "10 дел" },
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
      expect.objectContaining({
        title: "Дело 1",
        when: "Просрочено · 12 октября",
        isOverdue: true,
      }),
      expect.objectContaining({
        title: "Прививка: Бешенство — Бьюик",
        action: { kind: "record", title: "Записать" },
      }),
      expect.objectContaining({
        title: "Дело 2",
        when: "Сегодня",
        isOverdue: false,
        action: { kind: "complete", title: "Отметить выполненным" },
      }),
    ]);
    expect(model.more()).toBe("Ещё 1 дело");
  });

  test("opens the Feed from «Ещё N»", async () => {
    const { model, opened } = startToday();

    model.openFeed();

    expect(opened).toEqual(["feed"]);
  });

  test("completes a Plan with one tap and keeps the undo until it is dismissed", async () => {
    const { model, calls } = startToday({ due: [planDue(1, "2026-10-12")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.completeOrRecord("plan-plan-1");

    expect(model.rows()).toEqual([]);
    expect(model.header()).toBe("День свободен");
    expect(model.undo()).toEqual({ title: "Дело 1" });
    await vi.waitFor(() => {
      expect(calls).toContain("POST /api/plans/plan-1/complete");
    });

    await vi.waitFor(() => {
      expect(calls.filter((call) => call === "GET /api/today")).toHaveLength(2);
    });
    expect(model.undo()).toEqual({ title: "Дело 1" });

    model.dismissUndo();

    expect(model.undo()).toBeUndefined();
    expect(model.rows()).toEqual([]);
  });

  test("puts back the Plan and the Subplans its completion closed when the undo is tapped", async () => {
    const { model, calls } = startToday({ due: [planDue(1, "2026-10-12")] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.completeOrRecord("plan-plan-1");
    model.revert();

    expect(model.rows()).toHaveLength(1);
    expect(model.undo()).toBeUndefined();
    await vi.waitFor(() => {
      expect(calls).toContain("POST /api/plans/plan-1/subplans/sub-a/reopen");
    });
    expect(calls).toContain("POST /api/plans/plan-1/reopen");
    expect(calls).not.toContain("POST /api/plans/plan-1/subplans/sub-b/reopen");
    expect(calls.indexOf("POST /api/plans/plan-1/complete")).toBeLessThan(
      calls.indexOf("POST /api/plans/plan-1/reopen"),
    );
  });

  test("brings the row back and says so when the Plan cannot be completed", async () => {
    const { model } = startToday(
      { due: [planDue(1, "2026-10-12")] },
      { failing: "/api/plans/plan-1/complete" },
    );

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.completeOrRecord("plan-plan-1");

    await vi.waitFor(() => {
      expect(model.completionFailure()).toBe(
        "Не получилось отметить «Дело 1». Попробуйте ещё раз.",
      );
    });
    expect(model.rows()).toHaveLength(1);
    expect(model.undo()).toBeUndefined();
  });

  test("opens a Due Date's Care Entry form for its Pet", async () => {
    const { model, opened, calls } = startToday({ due: [rabies] });

    await vi.waitFor(() => {
      expect(model.rows()).toHaveLength(1);
    });
    model.completeOrRecord("due-entry-1");

    expect(opened).toEqual(["record entry-1 for pet-1"]);
    expect(calls).toEqual(["GET /api/today"]);
  });
});

describe("«Впереди»", () => {
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
          activeCount: 2,
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
        title: "Питомцы",
        value: "2",
        note: "Прививка: Нобивак — Мурка · 20 октября",
        isAlert: false,
      },
      { module: "goals", title: "Цели", value: "25%", note: "Диван", isAlert: false },
      { module: "albums", title: "Альбомы", value: "4", note: "фото за неделю", isAlert: false },
      { module: "recipes", title: "Рецепты", value: undefined, note: "Борщ", isAlert: false },
    ]);
  });

  test("say in words that the Pets tile's Due Date is Overdue, not by colour alone", async () => {
    const { model } = startToday({
      tiles: {
        ...quiet,
        pet: {
          activeCount: 1,
          only: { petId: "pet-1", name: "Бьюик" },
          due: { label: "Прививка: Бешенство", date: "2026-10-12" },
        },
      },
    });

    await vi.waitFor(() => {
      expect(model.tiles()[2]).toMatchObject({
        title: "Бьюик",
        note: "Просрочено · Прививка: Бешенство · 12 октября",
        isAlert: true,
      });
    });
  });

  test.each([
    {
      pet: { activeCount: 1, only: { petId: "pet-1", name: "Бьюик" }, due: null },
      opened: { kind: "pet", petId: "pet-1" },
    },
    { pet: { activeCount: 0, only: null, due: null }, opened: { kind: "new-pet" } },
    { pet: { activeCount: 2, only: null, due: null }, opened: "section pet" },
  ])("open the Pets tile for $pet.activeCount active Pets", async ({ pet, opened: target }) => {
    const { model, opened } = startToday({ tiles: { ...quiet, pet } });

    await vi.waitFor(() => {
      expect(model.tiles()).toHaveLength(6);
    });
    model.openTile("pet");

    expect(opened).toEqual([target]);
  });
});
