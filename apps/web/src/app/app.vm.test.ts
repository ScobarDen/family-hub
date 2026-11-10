import { context, noop, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { recipeChange, type Recipe, type Task, type Today } from "@family-hub/contract";

import { startApp } from "./app.fixtures.ts";

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

// The router mirrors the URL into the browser's history, which Node has none of.
beforeEach(() => {
  context.reset();
  vi.stubGlobal("history", { pushState: noop, replaceState: noop });
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
    await sleep(50);

    expect(countOf("GET /api/today")).toBe(2);
  });
});
