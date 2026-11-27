import { atom, context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { SlotModule } from "@family-hub/contract";

import { reatomNestedBack } from "@/modules/form";
import { fakeHaptics, fakeWindow } from "@/modules/telegram";

import { reatomNavigation } from "./app.route.ts";

type Steps = { canGoBack: () => boolean; closesInPlace: () => boolean; back: () => void };

const telegram = { ...fakeWindow(), haptics: fakeHaptics(), showPopup: async () => "cancel" };

function stepsBack(name: string, steps: Steps) {
  return reatomNestedBack({ name: `test.${name}.back`, telegram, ...steps });
}

const nothing: Steps = { canGoBack: () => false, closesInPlace: () => false, back: noop };

function nestedBacks(own: Partial<Record<SlotModule | "profile", Steps>>) {
  const steps = {
    tasks: nothing,
    pet: nothing,
    goals: nothing,
    albums: nothing,
    recipes: nothing,
    profile: nothing,
    ...own,
  };

  return {
    tasks: stepsBack("tasks", steps.tasks),
    pet: stepsBack("pet", steps.pet),
    goals: stepsBack("goals", steps.goals),
    albums: stepsBack("albums", steps.albums),
    recipes: stepsBack("recipes", steps.recipes),
    profile: stepsBack("profile", steps.profile),
  };
}

function startNavigation({
  isWide = false,
  nestedBack,
}: { isWide?: boolean; nestedBack?: ReturnType<typeof nestedBacks> } = {}) {
  const button = { isAvailable: true, follow: () => noop };
  const navigation = reatomNavigation({
    base: "/family-hub/",
    slots: () => ["tasks", "recipes"],
    isSignedIn: () => true,
    isWide: () => isWide,
    telegram: { backButton: button, settingsButton: button },
    ...(nestedBack === undefined ? {} : { nestedBack }),
  });

  navigation.screen.subscribe(noop);

  return navigation;
}

// The router mirrors the URL into the browser's history, which Node has none of.
beforeEach(() => {
  context.reset();
  vi.stubGlobal("history", { pushState: noop, replaceState: noop });
});

describe("the tab stacks", () => {
  test("start on the Today hub with nothing to go back to", () => {
    const navigation = startNavigation();

    expect(navigation.screen()).toEqual({ kind: "today" });
    expect(navigation.activeTab()).toBe("today");
    expect(navigation.canGoBack()).toBe(false);
  });

  test("open a section on top of the hub and keep the Today tab highlighted", () => {
    const navigation = startNavigation();

    navigation.openModule("goals");

    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
    expect(navigation.activeTab()).toBe("today");
    expect(navigation.canGoBack()).toBe(true);

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "today" });
    expect(navigation.canGoBack()).toBe(false);
  });

  test("switch to a slot's own tab when its section is opened from elsewhere", () => {
    const navigation = startNavigation();

    navigation.openModule("tasks");

    expect(navigation.screen()).toEqual({ kind: "module", module: "tasks" });
    expect(navigation.activeTab()).toBe("tasks");
    expect(navigation.canGoBack()).toBe(false);

    navigation.openTab("sections");
    navigation.open({ module: "recipes" });

    expect(navigation.activeTab()).toBe("recipes");
    expect(navigation.canGoBack()).toBe(false);
  });

  test("give a Pet's card its own place on the stack", () => {
    const navigation = startNavigation();

    navigation.openTab("sections");
    navigation.openModule("pet");
    navigation.openPet("pet-1");

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet", petId: "pet-1" });
    expect(navigation.openedPetId()).toBe("pet-1");

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet" });

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "sections" });
    expect(navigation.activeTab()).toBe("sections");
  });

  test("go to a tab's root on a tap, the active tab included", () => {
    const navigation = startNavigation();

    navigation.openTab("recipes");
    navigation.openModule("goals");
    navigation.openTab("recipes");

    expect(navigation.screen()).toEqual({ kind: "module", module: "recipes" });
    expect(navigation.canGoBack()).toBe(false);
  });

  test("land a launch link on top of the hub, whatever the slots", () => {
    const navigation = startNavigation();

    navigation.openTab("sections");
    navigation.launch({ module: "goals" });

    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
    expect(navigation.activeTab()).toBe("today");

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "today" });
  });

  test("step back inside a module before leaving it", () => {
    const button = { isAvailable: true, follow: () => noop };
    let isFormOpen = true;
    const navigation = reatomNavigation({
      base: "/family-hub/",
      slots: () => ["tasks", "recipes"],
      isSignedIn: () => true,
      telegram: { backButton: button, settingsButton: button },
      nestedBack: nestedBacks({
        goals: {
          canGoBack: () => isFormOpen,
          closesInPlace: () => isFormOpen,
          back: () => {
            isFormOpen = false;
          },
        },
      }),
    });

    navigation.openModule("goals");
    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "today" });
  });

  test("close the Profile's drawer before leaving the Profile", () => {
    const button = { isAvailable: true, follow: () => noop };
    let isDrawerOpen = true;
    const navigation = reatomNavigation({
      base: "/family-hub/",
      slots: () => ["tasks", "recipes"],
      isSignedIn: () => true,
      telegram: { backButton: button, settingsButton: button },
      nestedBack: nestedBacks({
        profile: {
          canGoBack: () => isDrawerOpen,
          closesInPlace: () => isDrawerOpen,
          back: () => {
            isDrawerOpen = false;
          },
        },
      }),
    });

    navigation.openProfile();
    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "profile" });

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "today" });
  });
});

describe("the sidebar on a wide window", () => {
  test("switches to a module outside the slots opened from Today, and Back leads to its root", () => {
    const isRecordOpen = atom(false, "test.isRecordOpen");
    const navigation = startNavigation({
      isWide: true,
      nestedBack: nestedBacks({
        goals: {
          canGoBack: () => isRecordOpen(),
          closesInPlace: () => false,
          back: () => {
            isRecordOpen.set(false);
          },
        },
      }),
    });

    navigation.open({ module: "goals" });
    isRecordOpen.set(true);

    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
    expect(navigation.activeTab()).toBe("goals");
    expect(navigation.canGoBack()).toBe(true);

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
    expect(navigation.canGoBack()).toBe(false);
  });

  test("switches to a record's module when it is opened from another module", () => {
    const navigation = startNavigation({ isWide: true });

    navigation.openModule("feed");
    navigation.open({ module: "albums" });

    expect(navigation.screen()).toEqual({ kind: "module", module: "albums" });
    expect(navigation.activeTab()).toBe("albums");
    expect(navigation.canGoBack()).toBe(false);
  });

  test("lays a Pet's card over the Pets, and Back returns to the list", () => {
    const navigation = startNavigation({ isWide: true });

    navigation.openPet("pet-1");

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet", petId: "pet-1" });
    expect(navigation.activeTab()).toBe("pet");
    expect(navigation.canGoBack()).toBe(true);

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet" });
    expect(navigation.activeTab()).toBe("pet");
    expect(navigation.canGoBack()).toBe(false);
  });

  test("returns to the root on a click on the active item", () => {
    const navigation = startNavigation({ isWide: true });

    navigation.openModule("pet");
    navigation.openPet("pet-1");
    navigation.openTab("pet");

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet" });
    expect(navigation.canGoBack()).toBe(false);
  });

  test("opens the Profile as a root with no Back on it", () => {
    const navigation = startNavigation({ isWide: true });

    navigation.openModule("goals");
    navigation.openProfile();

    expect(navigation.screen()).toEqual({ kind: "profile" });
    expect(navigation.activeTab()).toBe("profile");
    expect(navigation.canGoBack()).toBe(false);
  });

  test("lands a launch link under its module", () => {
    const navigation = startNavigation({ isWide: true });

    navigation.launch({ module: "pet", petId: "pet-1" });

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet", petId: "pet-1" });
    expect(navigation.activeTab()).toBe("pet");

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "module", module: "pet" });
    expect(navigation.canGoBack()).toBe(false);
  });
});

function startSliding() {
  const button = { isAvailable: true, follow: () => noop };
  const slides: string[] = [];
  let nested: "none" | "form" | "record" = "none";
  const navigation = reatomNavigation({
    base: "/family-hub/",
    slots: () => ["tasks", "recipes"],
    isSignedIn: () => true,
    telegram: { backButton: button, settingsButton: button },
    nestedBack: nestedBacks({
      goals: {
        canGoBack: () => nested !== "none",
        closesInPlace: () => nested === "form",
        back: () => {
          nested = "none";
        },
      },
    }),
    slide: (direction, update) => {
      slides.push(direction);
      update();
    },
  });

  navigation.screen.subscribe(noop);

  return {
    navigation,
    slides,
    openForm: () => {
      nested = "form";
    },
    openRecord: () => {
      nested = "record";
    },
  };
}

describe("screen transitions", () => {
  test("slide a pushed screen forward and Back the other way", () => {
    const { navigation, slides } = startSliding();

    navigation.openModule("goals");
    navigation.back();

    expect(slides).toEqual(["forward", "back"]);
    expect(navigation.screen()).toEqual({ kind: "today" });
  });

  test("close a form over a module without sliding the screen under it", () => {
    const { navigation, slides, openForm } = startSliding();

    navigation.openModule("goals");
    openForm();
    navigation.back();

    expect(slides).toEqual(["forward"]);
    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
    expect(navigation.canGoBack()).toBe(true);
  });

  test("slide Back from a record to its module's list", () => {
    const { navigation, slides, openRecord } = startSliding();

    navigation.openModule("goals");
    openRecord();
    navigation.back();

    expect(slides).toEqual(["forward", "back"]);
    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
  });

  test("slide forward to a slot's own tab when its section is opened from elsewhere", () => {
    const { navigation, slides } = startSliding();

    navigation.openModule("tasks");

    expect(slides).toEqual(["forward"]);
    expect(navigation.screen()).toEqual({ kind: "module", module: "tasks" });
  });

  test("slide a tab switch forward unless the tab's root is already on screen", () => {
    const { navigation, slides } = startSliding();

    navigation.openTab("recipes");
    navigation.openTab("recipes");

    expect(slides).toEqual(["forward"]);
    expect(navigation.screen()).toEqual({ kind: "module", module: "recipes" });
  });

  test("swap a launch link at once", () => {
    const { navigation, slides } = startSliding();

    navigation.launch({ module: "goals" });

    expect(slides).toEqual([]);
    expect(navigation.screen()).toEqual({ kind: "module", module: "goals" });
  });
});
