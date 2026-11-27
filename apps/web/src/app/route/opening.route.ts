import { action } from "@reatom/core";

import type { AppModule } from "@family-hub/contract";

import { placeScreen, type Place, type Screen } from "./screen.route.ts";
import type { Stack, StackDependencies } from "./tab-stack.route.ts";

type OpeningDependencies = Pick<StackDependencies, "screen" | "slots" | "isWide">;

// A section in a slot opens its own tab, so the highlighted tab is always the one on screen and
// the section's one state lives in one stack; any other section goes on top of the current tab.
// On a wide window every section is a tab, and a Pet's card lies over the Pets.
function placing(stack: Stack, { slots, isWide }: OpeningDependencies) {
  function openPet(petId: string) {
    const card: Screen = { kind: "module", module: "pet", petId };

    if (isWide() && stack.activeTab() !== "pet") {
      stack.openIn("pet", card);
    } else {
      stack.push(card);
    }
  }

  function placeWide(next: Place) {
    if (next.petId === undefined) {
      stack.openTab(next.module);
    } else {
      openPet(next.petId);
    }
  }

  function place(next: Place) {
    if (isWide()) {
      placeWide(next);

      return;
    }

    const slot = slots().find((module) => module === next.module);

    if (slot !== undefined && next.petId === undefined) {
      stack.openTab(slot);
    } else {
      stack.push(placeScreen(next));
    }
  }

  return { openPet, place };
}

export function reatomOpening(stack: Stack, dependencies: OpeningDependencies) {
  const { screen, isWide } = dependencies;
  const { openPet, place } = placing(stack, dependencies);

  return {
    open: action((next: Place) => {
      place(next);
    }, "navigation.open"),
    openModule: action((module: AppModule) => {
      place({ module });
    }, "navigation.openModule"),
    openPet: action((petId: string) => {
      openPet(petId);
    }, "navigation.openPet"),
    openTabBarMenu: action(() => {
      stack.push({ kind: "tab-bar-menu" });
    }, "navigation.openTabBarMenu"),
    openProfile: action(() => {
      if (isWide()) {
        stack.openTab("profile");
      } else if (screen().kind !== "profile") {
        stack.push({ kind: "profile" });
      }
    }, "navigation.openProfile"),
  };
}
