import { context, noop } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { CareEntry, Goal, Pet, Recipe, Task } from "@family-hub/contract";

import { startApp } from "../app.fixtures.ts";

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

const murka: Pet = { ...buick, id: "pet-2", name: "Мурка", species: "cat", breed: null };

const parkWalk: CareEntry = {
  id: "entry-1",
  petId: "pet-1",
  occurredAt: Date.parse("2026-01-04T09:00:00Z"),
  note: "Гуляли в парке",
  details: { kind: "note" },
  author: "Ася",
  photos: [],
};

const vetVisit: Task = {
  id: "0199b4d2-6c00-7abc-8def-0123456789ab",
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
  pet: { id: "pet-1", name: "Бьюик", picture: null },
  album: null,
  completions: [],
  subtasks: [],
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

function goalBook() {
  return { goals: [savings], totalSaved: savings.balance };
}

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

const recipeBook = {
  "GET /api/recipes": () => [lasagna],
  "GET /api/recipe-tags": () => [],
  "GET /api/recipes/recipe-1": () => lasagna,
};

// The router mirrors the URL into the browser's history, which Node has none of.
beforeEach(() => {
  context.reset();
  vi.stubGlobal("history", { pushState: noop, replaceState: noop });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe("a deep link the app was launched with", () => {
  test.each([
    { startParameter: "pet_pet-1", module: "pet" },
    { startParameter: "entry_entry-1", module: "pet" },
    { startParameter: "task_task-1", module: "tasks" },
    { startParameter: "goal_goal-1", module: "goals" },
    { startParameter: "album_album-1", module: "albums" },
    { startParameter: "recipe_recipe-1", module: "recipes" },
  ])("$startParameter shows the $module module", ({ startParameter, module }) => {
    const { app } = startApp({}, { startParameter });

    expect(app.home.navigation.shownModule()).toBe(module);
  });

  test("of a Recipe opens it", async () => {
    const { app } = startApp(recipeBook, { startParameter: "recipe_recipe-1" });
    const { recipes } = app.home;

    await vi.waitFor(() => {
      expect(recipes.screen()).toMatchObject({ kind: "recipe", recipe: { title: "Лазанья" } });
    });
  });

  test("of a Care Entry opens it on its Pet's card", async () => {
    const { app } = startApp(
      {
        "GET /api/pets": () => [buick, murka],
        "GET /api/pets/pet-1/care-entries": () => [parkWalk],
        "GET /api/care-entries/entry-1": () => parkWalk,
      },
      { startParameter: "entry_entry-1" },
    );
    const { navigation, pet } = app.home;

    await vi.waitFor(() => {
      expect(pet.care.isFormOpen()).toBe(true);
    });
    expect(navigation.openedPetId()).toBe("pet-1");
  });

  test("of a Pet's Occurrence completes it and opens a Care Entry for the Pet", async () => {
    const { app, countOf } = startApp(
      {
        "GET /api/tasks": () => [vetVisit],
        [`POST /api/tasks/${vetVisit.id}/complete`]: () => vetVisit,
        "GET /api/pets": () => [buick, murka],
        "GET /api/pets/pet-1/care-entries": () => [],
      },
      { startParameter: `rec_${vetVisit.id}_2026-01-05` },
    );
    const { navigation, pet } = app.home;

    await vi.waitFor(() => {
      expect(pet.care.isFormOpen()).toBe(true);
    });
    expect(navigation.openedPetId()).toBe("pet-1");
    expect(countOf(`POST /api/tasks/${vetVisit.id}/complete`)).toBe(1);
  });
});

describe("«Добавить задачу» on a Pet's card", () => {
  test("opens the Task form in the tasks module", () => {
    const { app } = startApp({ "GET /api/pets": () => [buick] });
    const { navigation, pet, tasks } = app.home;

    pet.pets.addTask("pet-1");

    expect(navigation.shownModule()).toBe("tasks");
    expect(tasks.openForm()).toBe("task");
  });
});

describe("a quick-add", () => {
  test("of a contribution opens the movement form of its Goal", async () => {
    const { app } = startApp({ "GET /api/goals": goalBook });
    const { navigation, quickAdd, goals } = app.home;

    quickAdd.add({ kind: "new-contribution", goalId: "goal-1" });

    await vi.waitFor(() => {
      expect(goals.openForm()).toBe("movement");
    });
    expect(navigation.shownModule()).toBe("goals");
  });

  test("of a contribution opens no form once its Goal turns out gone", async () => {
    const { app } = startApp({ "GET /api/goals": goalBook });
    const { quickAdd, goals } = app.home;

    quickAdd.add({ kind: "new-contribution", goalId: "goal-gone" });
    await vi.waitFor(() => {
      expect(goals.openedGoalState()).toBe("missing");
    });
    await settle();

    expect(goals.openForm()).toBeUndefined();
  });

  test("of a Care Entry asks which Pet it is for, then opens the form", async () => {
    const { app } = startApp({
      "GET /api/pets": () => [buick, murka],
      "GET /api/pets/pet-2/care-entries": () => [],
    });
    const { navigation, quickAdd, pet } = app.home;

    quickAdd.add({ kind: "new-care-entry" });
    await settle();

    expect(navigation.shownModule()).toBe("pet");
    expect(pet.care.isFormOpen()).toBe(false);

    pet.pets.open("pet-2");

    await vi.waitFor(() => {
      expect(pet.care.isFormOpen()).toBe(true);
    });
  });

  test("of a Care Entry is given up once the Member leaves the pet tab", async () => {
    const { app } = startApp({
      "GET /api/pets": () => [buick, murka],
      "GET /api/pets/pet-2/care-entries": () => [],
    });
    const { navigation, quickAdd, pet } = app.home;

    quickAdd.add({ kind: "new-care-entry" });
    await settle();
    navigation.openModule("feed");
    await settle();
    navigation.openModule("pet");
    pet.pets.open("pet-2");
    await settle();

    expect(navigation.openedPetId()).toBe("pet-2");
    expect(pet.care.isFormOpen()).toBe(false);
  });

  test("of a Care Entry is dropped when something else is opened meanwhile", async () => {
    const { app } = startApp({
      "GET /api/pets": () => [buick, murka],
      "GET /api/pets/pet-2/care-entries": () => [],
      "GET /api/goals": goalBook,
    });
    const { navigation, quickAdd, pet, goals } = app.home;

    quickAdd.add({ kind: "new-care-entry" });
    quickAdd.add({ kind: "new-contribution", goalId: "goal-1" });
    await vi.waitFor(() => {
      expect(goals.openForm()).toBe("movement");
    });
    navigation.openModule("pet");
    pet.pets.open("pet-2");
    await settle();

    expect(pet.care.isFormOpen()).toBe(false);
  });
});

test("«+ Фото» uploads to the Family's photos in the albums module", () => {
  const { app } = startApp({});
  const { navigation, quickAdd, albums } = app.home;

  quickAdd.addPhotos([new Blob(["a"]), new Blob(["b"])]);

  expect(navigation.shownModule()).toBe("albums");
  expect(albums.batch.isActive()).toBe(true);
});
