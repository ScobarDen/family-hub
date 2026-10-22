import { atom, context, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { AppModule, CareEntryDraft, CommandDraft } from "@family-hub/contract";

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

  function record(name: string) {
    return (value: unknown) => {
      opened.push(`${name} ${typeof value === "string" ? value : JSON.stringify(value)}`);
    };
  }

  const opener = reatomOpener({
    telegram: { startParam: startParameter },
    navigation: {
      openModule: (module) => {
        shownModule.set(module);
      },
      openLaunchModule: (module) => {
        shownModule.set(module);
      },
      shownModule: () => shownModule(),
    },
    isSignedIn: () => signedIn(),
    pets: {
      open: (petId) => {
        openedPetId.set(petId);
        record("pets.open")(petId);
      },
      showChoice: () => {
        openedPetId.set(undefined);
        opened.push("pets.showChoice");
      },
      openedPetId: () => openedPetId(),
    },
    plans: { open: record("plans.open"), addForPet: record("plans.addForPet") },
    care: {
      openEntry: record("care.openEntry"),
      followUp: record("care.followUp"),
      editDraft: ({ draftId }) => {
        opened.push(`care.editDraft ${draftId} for ${openedPetId() ?? "nobody"}`);
      },
    },
    calendar: {
      openEvent: record("calendar.openEvent"),
      openEventDraft: ({ draftId }) => {
        opened.push(`calendar.openEventDraft ${draftId}`);
      },
      openReminderDraft: ({ draftId }) => {
        opened.push(`calendar.openReminderDraft ${draftId}`);
      },
    },
    goals: { open: record("goals.open") },
    albums: { open: record("albums.open") },
    recipes: { open: record("recipes.open") },
    commandSheet: { openForEdit: record("commandSheet.openForEdit") },
  });

  return { opener, opened, shownModule, signedIn, openedPetId };
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
    { startParam: "pet_pet-1", module: "pet", opened: ["pets.open pet-1"] },
    { startParam: "entry_entry-7", module: "pet", opened: ["care.openEntry entry-7"] },
    { startParam: "event_event-1", module: "calendar", opened: ["calendar.openEvent event-1"] },
    { startParam: "goal_goal-1", module: "goals", opened: ["goals.open goal-1"] },
    { startParam: "plan_plan-1", module: "plans", opened: ["plans.open plan-1"] },
    { startParam: "cmd_draft-1", module: undefined, opened: ["commandSheet.openForEdit draft-1"] },
    { startParam: "inv_token-1", module: undefined, opened: [] },
    { startParam: "nonsense", module: undefined, opened: [] },
    { startParam: undefined, module: undefined, opened: [] },
  ])("$startParam opens $module with $opened", async ({ startParam, module, opened }) => {
    const started = startOpener({ startParam });

    started.opener.launch();

    await vi.waitFor(() => {
      expect(started.opened).toEqual(opened);
    });
    expect(started.shownModule()).toBe(module);
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
      opened: ["pets.open pet-2", "care.openEntry entry-7"],
    },
    {
      target: { kind: "due-date", petId: "pet-2", entryId: "entry-7" },
      module: "pet",
      opened: ["pets.open pet-2", "care.followUp entry-7"],
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
      expect(started.opened).toEqual(["pets.open pet-1", "care.editDraft draft-3 for pet-1"]);
    });
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
