import { context, noop } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  recipeChange,
  type CareEntry,
  type Goal,
  type Pet,
  type Photo,
  type Recipe,
  type Task,
  type Today,
} from "@family-hub/contract";

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

function photo(id: string): Photo {
  return {
    id,
    takenAt: null,
    urls: {
      thumb: `/photos/${id}/thumb`,
      medium: `/photos/${id}/medium`,
      full: `/photos/${id}/full`,
    },
    canDelete: true,
  };
}

const lasagnaPhoto = photo("photo-1");

const walkPhoto = photo("photo-2");

const buick: Pet = {
  id: "pet-1",
  name: "Бьюик",
  species: "dog",
  breed: "Бигль",
  sex: "male",
  birthDate: "2022-05-14",
  chipNumber: null,
  notes: null,
  archivedAt: null,
  memo: { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null },
  avatar: null,
};

const parkWalk: CareEntry = {
  id: "entry-1",
  petId: "pet-1",
  occurredAt: Date.parse("2026-01-04T09:00:00Z"),
  note: "Гуляли в парке",
  details: { kind: "note" },
  author: "Ася",
  photos: [walkPhoto],
};

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

describe("a Photo deleted in the viewer", () => {
  test("leaves the open Recipe, which loads once more", async () => {
    let current: Recipe = { ...lasagna, photos: [lasagnaPhoto] };
    const { app, countOf } = startApp(
      {
        ...recipeBook().routes,
        "GET /api/recipes/recipe-1": () => current,
        "DELETE /api/photos/photo-1": () => {
          current = { ...current, photos: [] };

          return { status: "deleted" };
        },
      },
      { popups: "confirmed" },
    );
    const { recipes } = app.home;

    await openLasagna(app);
    recipes.viewer.open([lasagnaPhoto], "photo-1");
    recipes.viewer.remove();
    await vi.waitFor(() => {
      expect(recipes.screen()).toMatchObject({ kind: "recipe", recipe: { photos: [] } });
    });
    await vi.runAllTimersAsync();

    expect(countOf("GET /api/recipes/recipe-1")).toBe(2);
  });

  test("leaves the Pet's journal, which loads once more", async () => {
    let entry = parkWalk;
    const { app, countOf } = startApp(
      {
        "GET /api/pets": () => [buick],
        "GET /api/pets/pet-1/care-entries": () => [entry],
        "DELETE /api/photos/photo-2": () => {
          entry = { ...entry, photos: [] };

          return { status: "deleted" };
        },
      },
      { popups: "confirmed" },
    );
    const { care } = app.home.pet;

    care.journal.subscribe(noop);
    await vi.waitFor(() => {
      expect(care.journal()).toMatchObject([{ photos: [{ id: "photo-2" }] }]);
    });
    care.viewer.open([walkPhoto], "photo-2");
    care.viewer.remove();
    await vi.waitFor(() => {
      expect(care.journal()).toMatchObject([{ photos: [] }]);
    });
    await vi.runAllTimersAsync();

    expect(countOf("GET /api/pets/pet-1/care-entries")).toBe(2);
  });

  test("drops it from the Pet's card when it was the avatar", async () => {
    let pet: Pet = { ...buick, avatar: walkPhoto.urls };
    const { app } = startApp(
      {
        "GET /api/pets": () => [pet],
        "GET /api/pets/pet-1/care-entries": () => [parkWalk],
        "DELETE /api/photos/photo-2": () => {
          pet = { ...pet, avatar: null };

          return { status: "deleted" };
        },
      },
      { popups: "confirmed" },
    );
    const { pets, care } = app.home.pet;

    pets.screen.subscribe(noop);
    await vi.waitFor(() => {
      expect(pets.screen()).toMatchObject({
        card: { avatar: "https://api.family-hub.test/photos/photo-2/medium" },
      });
    });
    care.viewer.open([walkPhoto], "photo-2");
    care.viewer.remove();

    await vi.waitFor(() => {
      expect(pets.screen()).toMatchObject({ card: { avatar: undefined } });
    });
  });

  test("leaves the open Recipe when it is deleted from «Все фото»", async () => {
    let current: Recipe = { ...lasagna, photos: [lasagnaPhoto] };
    const { app } = startApp(
      {
        ...recipeBook().routes,
        "GET /api/recipes/recipe-1": () => current,
        "DELETE /api/photos/photo-1": () => {
          current = { ...current, photos: [] };

          return { status: "deleted" };
        },
      },
      { popups: "confirmed" },
    );
    const { recipes, albums } = app.home;

    await openLasagna(app);
    albums.viewer.open([lasagnaPhoto], "photo-1");
    albums.viewer.remove();

    await vi.waitFor(() => {
      expect(recipes.screen()).toMatchObject({ kind: "recipe", recipe: { photos: [] } });
    });
  });
});
