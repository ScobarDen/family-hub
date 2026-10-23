import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { reatomNavigation } from "./app.route.ts";

function startNavigation() {
  const button = { isAvailable: true, follow: () => noop };
  const navigation = reatomNavigation({
    base: "/family-hub/",
    slots: () => ["plans", "calendar"],
    isSignedIn: () => true,
    telegram: { backButton: button, settingsButton: button },
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

    navigation.openModule("plans");

    expect(navigation.screen()).toEqual({ kind: "module", module: "plans" });
    expect(navigation.activeTab()).toBe("today");
    expect(navigation.canGoBack()).toBe(true);

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "today" });
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

    navigation.openTab("calendar");
    navigation.openModule("goals");
    navigation.openTab("calendar");

    expect(navigation.screen()).toEqual({ kind: "module", module: "calendar" });
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
      slots: () => ["plans", "calendar"],
      isSignedIn: () => true,
      telegram: { backButton: button, settingsButton: button },
      nestedBack: {
        plans: {
          canGoBack: () => isFormOpen,
          back: () => {
            isFormOpen = false;
          },
        },
      },
    });

    navigation.openModule("plans");
    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "module", module: "plans" });

    navigation.back();

    expect(navigation.screen()).toEqual({ kind: "today" });
  });
});
