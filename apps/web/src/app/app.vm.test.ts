import { context, noop } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { recipeChange, type Goal, type Recipe, type Task, type Today } from "@family-hub/contract";

import { startApp, workerFailure } from "./app.fixtures.ts";

const lasagna: Recipe = {
  id: "recipe-1",
  title: "Лазанья",
  ingredients: ["Листы лазаньи", "Фарш", "Сыр"],
  method: "Собрать слоями и запечь.",
  photos: [],
  tags: [],
  isFavorite: false,
  canDelete: true,
  createdAt: 0,
};

const walk: Task = {
  id: "task-1",
  title: "Погулять с Бьюиком",
  note: null,
  when: null,
  recurrence: null,
  skippedDates: [],
  assignees: [],
  recipients: "default",
  reminderOffsets: [],
  visibility: "shared",
  isOwn: true,
  pet: null,
  album: null,
  completions: [],
  subtasks: [],
};

const todayWithWalk: Today = {
  due: [
    {
      kind: "task",
      key: "task-1-2026-01-05",
      title: walk.title,
      date: "2026-01-05",
      time: null,
      taskId: walk.id,
      occurrence: "2026-01-05",
      subtaskId: null,
      petId: null,
      petPicture: null,
      assignees: [],
    },
  ],
  next: [],
  tiles: {
    tasks: { open: 1, overdue: 1, week: 0 },
    pet: { activeCount: 0, only: null },
    goals: { nearest: null },
    albums: { photos: 0 },
    recipes: { count: 0 },
  },
};

const savings: Goal = {
  id: "goal-1",
  title: "Отпуск в Турции",
  target: 100_000,
  deadline: null,
  icon: "palmtree",
  color: "teal",
  note: null,
  visibility: "shared",
  isOwn: true,
  balance: 40_000,
  isAchieved: false,
  completed: null,
  shares: [],
  movements: [],
};

function recipeBook(saved: Recipe = lasagna) {
  let current = saved;

  return {
    rename: (title: string) => {
      current = { ...current, title };
    },
    routes: {
      "GET /api/recipes": () => [current],
      "GET /api/recipe-tags": () => [],
      "GET /api/recipes/recipe-1": () => current,
      "PUT /api/recipes/recipe-1": (body: unknown) => {
        const { title } = recipeChange.parse(body);

        current = { ...current, title };

        return current;
      },
    },
  };
}

type App = ReturnType<typeof startApp>["app"];

async function openLasagna(app: App) {
  const { recipes } = app.home;

  recipes.screen.subscribe(noop);
  recipes.open("recipe-1");
  await vi.waitFor(() => {
    expect(recipes.screen()).toMatchObject({ kind: "recipe", recipe: { title: "Лазанья" } });
  });
}

// The router mirrors the URL into the browser's history, which Node has none of. The clock is
// faked so the live versions' 300 ms window passes on demand.
beforeEach(() => {
  context.reset();
  vi.stubGlobal("history", { pushState: noop, replaceState: noop });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the open Recipe", () => {
  test("shows the Member's own edit once it is saved", async () => {
    const { app } = startApp(recipeBook().routes);
    const { recipes } = app.home;

    await openLasagna(app);
    recipes.edit();
    recipes.form.form.fields.title.set("Лазанья с грибами");
    recipes.form.save();

    await vi.waitFor(() => {
      expect(recipes.screen()).toMatchObject({
        kind: "recipe",
        recipe: { title: "Лазанья с грибами" },
      });
    });
  });

  test("shows another Member's edit", async () => {
    const book = recipeBook();
    const { app, connect, otherMemberChanged } = startApp(book.routes);

    await openLasagna(app);
    connect({ recipes: 1 });
    book.rename("Лазанья по-болонски");
    otherMemberChanged({ recipes: 2 });

    await vi.waitFor(() => {
      expect(app.home.recipes.screen()).toMatchObject({
        kind: "recipe",
        recipe: { title: "Лазанья по-болонски" },
      });
    });
  });
});

describe("Today", () => {
  test("loads once after an Occurrence is completed on it", async () => {
    const { app, countOf } = startApp({
      "GET /api/today": () => todayWithWalk,
      "POST /api/tasks/task-1/complete": () => walk,
    });
    const { today } = app.home;

    today.rows.subscribe(noop);
    await vi.waitFor(() => {
      expect(today.rows()).toHaveLength(1);
    });
    today.complete("task-1-2026-01-05");
    await vi.waitFor(() => {
      expect(countOf("GET /api/today")).toBe(2);
    });
    await vi.runAllTimersAsync();

    expect(countOf("GET /api/today")).toBe(2);
  });

  test("loads once more after a completion on it is undone", async () => {
    const { app, countOf } = startApp({
      "GET /api/today": () => todayWithWalk,
      "POST /api/tasks/task-1/complete": () => walk,
      "POST /api/tasks/task-1/reopen": () => walk,
    });
    const { today } = app.home;

    today.rows.subscribe(noop);
    await vi.waitFor(() => {
      expect(today.rows()).toHaveLength(1);
    });
    today.complete("task-1-2026-01-05");
    await vi.waitFor(() => {
      expect(countOf("GET /api/today")).toBe(2);
    });
    today.revert();
    await vi.waitFor(() => {
      expect(countOf("GET /api/today")).toBe(3);
    });
    await vi.runAllTimersAsync();

    expect(countOf("GET /api/today")).toBe(3);
  });
});

describe("a list whose refresh fails", () => {
  test("keeps showing what it had", async () => {
    let isDown = false;
    const book = recipeBook();
    const { app, connect, otherMemberChanged, countOf } = startApp({
      ...book.routes,
      "GET /api/recipes": () => (isDown ? workerFailure : [lasagna]),
    });
    const { recipes } = app.home;

    recipes.screen.subscribe(noop);
    await vi.waitFor(() => {
      expect(recipes.screen()).toMatchObject({ kind: "list" });
    });
    connect({ recipes: 1 });
    isDown = true;
    otherMemberChanged({ recipes: 2 });
    await vi.waitFor(() => {
      expect(countOf("GET /api/recipes")).toBe(2);
    });
    await vi.runAllTimersAsync();

    expect(recipes.screen()).toMatchObject({ kind: "list", recipes: [{ title: "Лазанья" }] });
  });

  test("says it failed when there was nothing to show", async () => {
    const { app } = startApp({ ...recipeBook().routes, "GET /api/recipes": () => workerFailure });
    const { recipes } = app.home;

    recipes.screen.subscribe(noop);

    await vi.waitFor(() => {
      expect(recipes.screen()).toEqual({ kind: "failed" });
    });
  });
});

describe("a Savings Goal saved while the list is loading", () => {
  test("stays as saved when the older answer arrives", async () => {
    let saved = savings;
    let answerStale = noop;
    let isHeld = false;
    const { app, connect, otherMemberChanged, countOf } = startApp({
      "GET /api/goals": async () => {
        const answer = { goals: [saved], totalSaved: saved.balance };

        if (isHeld) {
          isHeld = false;
          await new Promise<void>((resolve) => {
            answerStale = resolve;
          });
        }

        return answer;
      },
      "POST /api/goals/goal-1/movements": () => {
        saved = { ...savings, balance: 100_000, movements: [] };

        return saved;
      },
    });
    const { goals } = app.home;

    goals.screen.subscribe(noop);
    await vi.waitFor(() => {
      expect(goals.screen()).toMatchObject({ kind: "list" });
    });
    connect({ goals: 1 });
    isHeld = true;
    otherMemberChanged({ goals: 2 });
    await vi.waitFor(() => {
      expect(countOf("GET /api/goals")).toBe(2);
    });
    goals.open("goal-1");
    goals.addMovement("contribution");
    goals.movementForm.form.fields.amount.set("60000");
    goals.movementForm.save();
    await vi.waitFor(() => {
      expect(countOf("POST /api/goals/goal-1/movements")).toBe(1);
    });
    answerStale();
    await vi.advanceTimersByTimeAsync(0);

    expect(goals.screen()).toMatchObject({
      kind: "goal",
      goal: { progress: expect.stringMatching(/^100\s000\s₽ из 100\s000\s₽/u) },
    });
  });
});
