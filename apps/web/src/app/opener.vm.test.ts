import { atom, context, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { AppModule, CareEntryDraft, CommandDraft } from "@family-hub/contract";

import type { Place } from "./app.route.ts";
import { reatomOpener } from "./opener.vm.ts";

const phrase = { saidAt: Date.parse("2026-10-11T06:00:00Z"), timeZone: "Europe/Moscow" };

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
    plans: {
      open: record("plans.open"),
      add: () => {
        opened.push("plans.add");
      },
      addForPet: record("plans.addForPet"),
    },
    care: {
      openEntry: record("care.openEntry"),
      followUp: record("care.followUp"),
      add: () => {
        opened.push(`care.add for ${openedPetId() ?? "nobody"}`);
      },
      editDraft: ({ draftId }) => {
        opened.push(`care.editDraft ${draftId} for ${openedPetId() ?? "nobody"}`);
      },
    },
    calendar: {
      openEvent: record("calendar.openEvent"),
      add: () => {
        opened.push("calendar.add");
      },
      openEventDraft: ({ draftId }) => {
        opened.push(`calendar.openEventDraft ${draftId}`);
      },
      openReminderDraft: ({ draftId }) => {
        opened.push(`calendar.openReminderDraft ${draftId}`);
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
    commandSheet: { openForEdit: record("commandSheet.openForEdit") },
  });

  return { opener, opened, places, shownModule, signedIn, openedPetId };
}

const careDraft: CareEntryDraft = {
  kind: "care_entry",
  petId: null,
  date: null,
  time: null,
  note: null,
  details: { kind: "weight", weightKg: 31.5 },
  missing: ["pet"],
  ambiguities: [],
};

const eventDraft: CommandDraft = {
  kind: "event",
  title: "Груминг Бьюика",
  note: null,
  date: "2026-10-24",
  time: "11:00",
  endDate: null,
  endTime: null,
  recurrence: null,
  visibility: "shared",
  reminderOffsets: [],
  missing: [],
  ambiguities: [],
};

const reminderDraft: CommandDraft = {
  kind: "reminder",
  text: "Купить корм Бьюику",
  date: "2026-10-22",
  time: "19:00",
  recurrence: null,
  visibility: "shared",
  recipientIds: null,
  missing: [],
  ambiguities: [],
};

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
      startParam: "event_event-1",
      places: ['launch {"module":"calendar"}'],
      opened: ["calendar.openEvent event-1"],
    },
    {
      startParam: "goal_goal-1",
      places: ['launch {"module":"goals"}'],
      opened: ["goals.open goal-1"],
    },
    {
      startParam: "plan_plan-1",
      places: ['launch {"module":"plans"}'],
      opened: ["plans.open plan-1"],
    },
    { startParam: "cmd_draft-1", places: [], opened: ["commandSheet.openForEdit draft-1"] },
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

  test("names a draft or a Care Entry fetched with the session's token, so it waits for the sign-in", async () => {
    const draft = startOpener({ startParam: "cmd_draft-1", isSignedIn: false });
    const entry = startOpener({ startParam: "entry_entry-7", isSignedIn: false });

    draft.opener.launch();
    entry.opener.launch();
    await sleep(0);

    expect(draft.opened).toEqual([]);
    expect(entry.opened).toEqual([]);
    expect(entry.shownModule()).toBe("pet");

    draft.signedIn.set(true);
    entry.signedIn.set(true);

    await vi.waitFor(() => {
      expect(draft.opened).toEqual(["commandSheet.openForEdit draft-1"]);
      expect(entry.opened).toEqual(["care.openEntry entry-7"]);
    });
  });
});

describe("a record opened from another module", () => {
  test.each([
    { target: { kind: "plan", planId: "plan-1" }, module: "plans", opened: ["plans.open plan-1"] },
    {
      target: { kind: "plan-for-pet", petId: "pet-1" },
      module: "plans",
      opened: ["plans.addForPet pet-1"],
    },
    { target: { kind: "calendar" }, module: "calendar", opened: [] },
    {
      target: { kind: "care-entry", petId: "pet-2", entryId: "entry-7" },
      module: "pet",
      opened: ["care.openEntry entry-7"],
    },
    {
      target: { kind: "due-date", petId: "pet-2", entryId: "entry-7" },
      module: "pet",
      opened: ["care.followUp entry-7"],
    },
    {
      target: { kind: "due-date", entryId: "entry-7" },
      module: "pet",
      opened: ["care.followUp entry-7"],
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

describe("a Command Draft handed over by «Изменить»", () => {
  test("lands in the Event or the Reminder form of the calendar", () => {
    const started = startOpener();

    started.opener.editDraft({ draftId: "draft-2", phrase, draft: eventDraft });
    expect(started.shownModule()).toBe("calendar");

    started.opener.editDraft({ draftId: "draft-1", phrase, draft: reminderDraft });
    expect(started.opened).toEqual([
      "calendar.openEventDraft draft-2",
      "calendar.openReminderDraft draft-1",
    ]);
  });

  test("of a Care Entry opens its Pet's card and the form over it", async () => {
    const started = startOpener();

    started.opener.editDraft({
      draftId: "draft-3",
      phrase,
      draft: { ...careDraft, petId: "pet-1" },
    });

    await vi.waitFor(() => {
      expect(started.opened).toEqual(["care.editDraft draft-3 for pet-1"]);
    });
    expect(started.places).toEqual(['open {"module":"pet","petId":"pet-1"}']);
    expect(started.shownModule()).toBe("pet");
  });

  test("of a Care Entry without a Pet asks for one, then opens the form with the draft's fields", async () => {
    const started = startOpener();

    started.openedPetId.set("pet-1");
    started.opener.editDraft({ draftId: "draft-3", phrase, draft: careDraft });
    await sleep(0);

    expect(started.shownModule()).toBe("pet");
    expect(started.opened).toEqual(["pets.showChoice"]);

    started.openedPetId.set("pet-2");

    await vi.waitFor(() => {
      expect(started.opened).toEqual(["pets.showChoice", "care.editDraft draft-3 for pet-2"]);
    });
  });

  test("of a Care Entry without a Pet is given up once the Member leaves the pet tab", async () => {
    const started = startOpener();

    started.opener.editDraft({ draftId: "draft-3", phrase, draft: careDraft });
    await sleep(0);
    started.shownModule.set("feed");
    await sleep(0);
    started.shownModule.set("pet");
    started.openedPetId.set("pet-2");
    await sleep(0);

    expect(started.opened).toEqual(["pets.showChoice"]);
  });

  test("of a Care Entry without a Pet is dropped when something else is opened meanwhile", async () => {
    const started = startOpener();

    started.opener.editDraft({ draftId: "draft-3", phrase, draft: careDraft });
    started.opener.open({ kind: "goal", goalId: "goal-1" });
    started.shownModule.set("pet");
    started.openedPetId.set("pet-2");
    await sleep(0);

    expect(started.opened).toEqual(["pets.showChoice", "goals.open goal-1"]);
  });
});

describe("«Быстро добавить»", () => {
  test.each([
    { target: { kind: "new-plan" }, opened: ["plans.add"] },
    { target: { kind: "new-event" }, opened: ["calendar.add"] },
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
});

test("«+ Фото» uploads to the Family's photos in the albums module", () => {
  const started = startOpener();

  started.opener.uploadPhotos([new Blob(["a"]), new Blob(["b"])]);

  expect(started.places).toEqual(['open {"module":"albums"}']);
  expect(started.opened).toEqual(["albums.upload 2"]);
});
