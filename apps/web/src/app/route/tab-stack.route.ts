import { action, atom, computed, isInit, withComputed, type Atom } from "@reatom/core";

import type { SlotModule } from "@family-hub/contract";

import type { Slide } from "@/modules/changes";
import type { NavigationTab } from "@/modules/sections";
import type { TabId } from "@/modules/tab-bar";

import {
  isSameScreen,
  isTabBarScreen,
  placeScreen,
  rootOf,
  type Place,
  type Screen,
} from "./screen.route.ts";

function trailTo(tab: NavigationTab, screen: Screen): Screen[] {
  const root = rootOf(tab);

  return isSameScreen(root, screen) ? [] : [root];
}

function wideTabOf(screen: Screen): NavigationTab {
  if (isTabBarScreen(screen)) {
    return "today";
  }

  return screen.kind === "module" ? screen.module : screen.kind;
}

// A reload lands on the tab whose root it is, or on top of the hub.
function narrowTabOf(screen: Screen, slots: SlotModule[]): TabId {
  if (isTabBarScreen(screen)) {
    return "sections";
  }

  const slot = slots.find((module) => screen.kind === "module" && module === screen.module);

  return slot !== undefined && screen.kind === "module" && screen.petId === undefined
    ? slot
    : "today";
}

export type StackDependencies = {
  screen: () => Screen;
  slots: () => SlotModule[];
  isWide: () => boolean;
  slide: Slide;
};

function atomResetOnWidthChange<State>(
  initial: State,
  { name, isWide }: { name: string; isWide: () => boolean },
): Atom<State> {
  return atom(initial, name).extend(
    withComputed((state) => {
      isWide();

      return isInit() ? state : initial;
    }),
  );
}

function reatomTabs(
  go: (screen: Screen) => void,
  { screen, slots, isWide, slide }: StackDependencies,
) {
  // Crossing the breakpoint recomputes the tab as a reload would and forgets the trail.
  const tab = atomResetOnWidthChange<NavigationTab | null>(null, {
    name: "navigation.tab",
    isWide,
  });
  const trail = atomResetOnWidthChange<Screen[]>([], { name: "navigation.trail", isWide });
  const activeTab = computed(
    (): NavigationTab => tab() ?? (isWide() ? wideTabOf(screen()) : narrowTabOf(screen(), slots())),
    "navigation.activeTab",
  );

  function settle(next: NavigationTab, nextScreen: Screen) {
    tab.set(next);
    trail.set(trailTo(next, nextScreen));
    go(nextScreen);
  }

  function switchTo(next: NavigationTab, nextScreen: Screen) {
    if (isSameScreen(screen(), nextScreen)) {
      settle(next, nextScreen);
    } else {
      slide(isWide() ? "fade" : "forward", () => {
        settle(next, nextScreen);
      });
    }
  }

  return { tab, trail, activeTab, settle, switchTo };
}

type Tabs = ReturnType<typeof reatomTabs>;

function reatomPush(
  go: (screen: Screen) => void,
  { screen, slide }: Pick<StackDependencies, "screen" | "slide">,
  { tab, trail, activeTab }: Tabs,
) {
  return action((next: Screen) => {
    const current = screen();

    if (!isSameScreen(current, next)) {
      slide("forward", () => {
        tab.set(activeTab());
        trail.set([...trail(), current]);
        go(next);
      });
    }
  }, "navigation.push");
}

// A launch link opens on top of the hub, whatever the slots are; a wide window opens its module.
function reatomLaunch(isWide: () => boolean, { settle }: Tabs) {
  return action((place: Place | undefined) => {
    if (place === undefined) {
      settle("today", { kind: "today" });
    } else {
      settle(isWide() ? place.module : "today", placeScreen(place));
    }
  }, "navigation.launch");
}

// Each tab is a stack: a section opens on top of the current tab (a slot's opens its tab), Back
// pops it, a tab tap goes to that tab's root. The stack lives in memory; the URL names only its
// top screen.
export function reatomStack(go: (screen: Screen) => void, dependencies: StackDependencies) {
  const tabs = reatomTabs(go, dependencies);
  const { trail, activeTab, switchTo } = tabs;

  return {
    activeTab,
    trail,
    push: reatomPush(go, dependencies, tabs),
    openTab: action((next: NavigationTab) => {
      switchTo(next, rootOf(next));
    }, "navigation.openTab"),
    openIn: action((next: NavigationTab, nextScreen: Screen) => {
      switchTo(next, nextScreen);
    }, "navigation.openIn"),
    launch: reatomLaunch(dependencies.isWide, tabs),
    landOnToday: action(() => {
      tabs.settle("today", { kind: "today" });
    }, "navigation.landOnToday"),
    pop: reatomPop(go, { trail, activeTab, slide: dependencies.slide }),
  };
}

function reatomPop(
  go: (screen: Screen) => void,
  {
    trail,
    activeTab,
    slide,
  }: { trail: Atom<Screen[]>; activeTab: () => NavigationTab; slide: Slide },
) {
  return action(() => {
    const previous = trail().at(-1);

    slide("back", () => {
      trail.set(trail().slice(0, -1));
      go(previous ?? rootOf(activeTab()));
    });
  }, "navigation.pop");
}

export type Stack = ReturnType<typeof reatomStack>;
