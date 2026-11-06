import { atom, context, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { AppModule } from "@family-hub/contract";

import type { Place } from "./app.route.ts";
import { reatomOpener } from "./opener.vm.ts";

function startOpener({
  startParam: startParameter = undefined as string | undefined,
  isSignedIn = true,
} = {}) {
  const shownModule = atom<AppModule | undefined>(undefined, "test.shownModule");
  const signedIn = atom(isSignedIn, "test.signedIn");
  const openedPetId = atom<string | undefined>(undefined, "test.openedPetId");
  const opened: string[] = [];
  const places: string[] = [];
  const goalState = atom<"loading" | "opened" | "missing">("loading", "test.goalState");

  function go(how: string) {
    return (place: Place | undefined) => {
      places.push(`${how} ${JSON.stringify(place)}`);
      shownModule.set(place?.module);

      if (place?.petId !== undefined) {
        openedPetId.set(place.petId);
      }
    };
  }

  function record(name: string) {
    return (value: unknown) => {
      opened.push(`${name} ${typeof value === "string" ? value : JSON.stringify(value)}`);
    };
  }

  const opener = reatomOpener({
    telegram: { startParam: startParameter },
    navigation: { open: go("open"), launch: go("launch"), shownModule: () => shownModule() },
    isSignedIn: () => signedIn(),
    pets: {
      add: () => {
        opened.push("pets.add");
      },
      showChoice: () => {
        openedPetId.set(undefined);
        opened.push("pets.showChoice");
      },
      openedPetId: () => openedPetId(),
    },
    tasks: {
      open: record("tasks.open"),
      add: () => {
        opened.push("tasks.add");
      },
      addForPet: record("tasks.addForPet"),
      recordOccurrence: record("tasks.recordOccurrence"),
    },
    care: {
      openEntry: record("care.openEntry"),
      add: () => {
        opened.push(`care.add for ${openedPetId() ?? "nobody"}`);
      },
      addFromTask: (taskTitle) => {
        opened.push(`care.addFromTask ${taskTitle} for ${openedPetId() ?? "nobody"}`);
      },
    },
    goals: {
      open: (goalId) => {
        record("goals.open")(goalId);
        goalState.set(goalId === "goal-gone" ? "missing" : "opened");
      },
      openedGoalState: () => goalState(),
      addMovement: record("goals.addMovement"),
    },
    albums: {
      open: record("albums.open"),
      upload: (files) => {
        opened.push(`albums.upload ${files.length}`);
      },
    },
    recipes: { open: record("recipes.open") },
  });

  return { opener, opened, places, shownModule, signedIn, openedPetId };
}

beforeEach(() => {
  context.reset();
});

describe("a deep link the Mini App was launched with", () => {
  test.each([
    { startParam: "pet_pet-1", places: ['launch {"module":"pet","petId":"pet-1"}'], opened: [] },
    {
      startParam: "entry_entry-7",
      places: ['launch {"module":"pet"}'],
      opened: ["care.openEntry entry-7"],
    },
    {
      startParam: "task_task-1",
      places: ['launch {"module":"tasks"}'],
      opened: ["tasks.open task-1"],
    },
    {
      startParam: "event_event-1",
      places: ['launch {"module":"tasks"}'],
      opened: ["tasks.open event-1"],
    },
    {
      startParam: "goal_goal-1",
      places: ['launch {"module":"goals"}'],
      opened: ["goals.open goal-1"],
    },
    {
      startParam: "plan_plan-1",
      places: ['launch {"module":"tasks"}'],
      opened: ["tasks.open plan-1"],
    },
    {
      startParam: "rec_0199b4d2-6c00-7abc-8def-0123456789ab_2026-10-05",
      places: ['launch {"module":"tasks"}'],
      opened: [
        'tasks.recordOccurrence {"taskId":"0199b4d2-6c00-7abc-8def-0123456789ab","occurrence":"2026-10-05"}',
      ],
    },
    {
      startParam: "recipe_recipe-1",
      places: ['launch {"module":"recipes"}'],
      opened: ["recipes.open recipe-1"],
    },
    {
      startParam: "album_album-1",
      places: ['launch {"module":"albums"}'],
      opened: ["albums.open album-1"],
    },
    { startParam: "rec_0199b4d2-6c00-7abc-8def-0123456789ab", places: [], opened: [] },
    { startParam: "rec_0199b4d2-6c00-7abc-8def-0123456789ab_soon", places: [], opened: [] },
    { startParam: "cmd_draft-1", places: [], opened: [] },
    { startParam: "inv_token-1", places: [], opened: [] },
    { startParam: "nonsense", places: [], opened: [] },
    { startParam: undefined, places: [], opened: [] },
  ])("$startParam lands on top of the hub at $places", async ({ startParam, places, opened }) => {
    const started = startOpener({ startParam });

    started.opener.launch();

    await vi.waitFor(() => {
      expect(started.places).toEqual(places);
      expect(started.opened).toEqual(opened);
    });
  });

  test("names a Care Entry fetched with the session's token, so it waits for the sign-in", async () => {
    const entry = startOpener({ startParam: "entry_entry-7", isSignedIn: false });

    entry.opener.launch();
    await sleep(0);

    expect(entry.opened).toEqual([]);
    expect(entry.shownModule()).toBe("pet");

    entry.signedIn.set(true);

    await vi.waitFor(() => {
      expect(entry.opened).toEqual(["care.openEntry entry-7"]);
    });
  });
});

describe("a record opened from another module", () => {
  test.each([
    { target: { kind: "task", taskId: "task-1" }, module: "tasks", opened: ["tasks.open task-1"] },
    {
      target: { kind: "task-for-pet", petId: "pet-1" },
      module: "tasks",
      opened: ["tasks.addForPet pet-1"],
    },
    {
      target: { kind: "care-entry-for-pet", petId: "pet-2", title: "Прививка: бешенство" },
      module: "pet",
      opened: ["care.addFromTask Прививка: бешенство for pet-2"],
    },
    {
      target: { kind: "care-entry", petId: "pet-2", entryId: "entry-7" },
      module: "pet",
      opened: ["care.openEntry entry-7"],
    },
    {
      target: { kind: "album", albumId: "album-1" },
      module: "albums",
      opened: ["albums.open album-1"],
    },
    {
      target: { kind: "recipe", recipeId: "recipe-1" },
      module: "recipes",
      opened: ["recipes.open recipe-1"],
    },
  ] as const)("$target.kind opens $module with $opened", async ({ target, module, opened }) => {
    const started = startOpener();

    started.opener.open(target);

    await vi.waitFor(() => {
      expect(started.opened).toEqual(opened);
    });
    expect(started.shownModule()).toBe(module);
  });
});

describe("a quick-add", () => {
  test.each([
    { target: { kind: "new-task" }, opened: ["tasks.add"] },
    {
      target: { kind: "new-contribution", goalId: "goal-1" },
      opened: ["goals.open goal-1", "goals.addMovement contribution"],
    },
    {
      target: { kind: "new-contribution", goalId: "goal-gone" },
      opened: ["goals.open goal-gone"],
    },
    { target: { kind: "new-pet" }, opened: ["pets.add"] },
  ] as const)("$target.kind opens the module's own form", async ({ target, opened }) => {
    const started = startOpener();

    started.opener.open(target);

    await vi.waitFor(() => {
      expect(started.opened).toEqual(opened);
    });
  });

  test("asks which Pet a Care Entry is for, then opens the form", async () => {
    const started = startOpener();

    started.opener.open({ kind: "new-care-entry" });
    await sleep(0);

    expect(started.opened).toEqual(["pets.showChoice"]);

    started.openedPetId.set("pet-2");

    await vi.waitFor(() => {
      expect(started.opened).toEqual(["pets.showChoice", "care.add for pet-2"]);
    });
  });

  test("of a Care Entry is given up once the Member leaves the pet tab", async () => {
    const started = startOpener();

    started.opener.open({ kind: "new-care-entry" });
    await sleep(0);
    started.shownModule.set("feed");
    await sleep(0);
    started.shownModule.set("pet");
    started.openedPetId.set("pet-2");
    await sleep(0);

    expect(started.opened).toEqual(["pets.showChoice"]);
  });

  test("of a Care Entry is dropped when something else is opened meanwhile", async () => {
    const started = startOpener();

    started.opener.open({ kind: "new-care-entry" });
    started.opener.open({ kind: "goal", goalId: "goal-1" });
    started.shownModule.set("pet");
    started.openedPetId.set("pet-2");
    await sleep(0);

    expect(started.opened).toEqual(["pets.showChoice", "goals.open goal-1"]);
  });
});

test("«+ Фото» uploads to the Family's photos in the albums module", () => {
  const started = startOpener();

  started.opener.uploadPhotos([new Blob(["a"]), new Blob(["b"])]);

  expect(started.places).toEqual(['open {"module":"albums"}']);
  expect(started.opened).toEqual(["albums.upload 2"]);
});
