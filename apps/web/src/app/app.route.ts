import {
  action,
  atom,
  computed,
  effect,
  isInit,
  noop,
  reatomRoute,
  withComputed,
  type Atom,
} from "@reatom/core";
import { z } from "zod";

import { appModule, type AppModule, type SlotModule } from "@family-hub/contract";

import { instantly, type Slide } from "@/modules/changes";
import type { NestedBack } from "@/modules/form";
import type { NavigationTab } from "@/modules/sections";
import type { TabId } from "@/modules/tab-bar";
import type { Telegram } from "@/modules/telegram";

export type Place = { module: AppModule; petId?: string };

export type Screen =
  | { kind: "today" }
  | { kind: "sections" }
  | { kind: "tab-bar-menu" }
  | { kind: "profile" }
  | { kind: "module"; module: AppModule; petId?: string };

// Every slot module and the Profile have screens to step back from; the Feed has none.
type NestedBacks = Record<SlotModule | "profile", NestedBack>;

type NavigationDependencies = {
  base: string;
  slots: () => SlotModule[];
  isSignedIn: () => boolean;
  isWide?: () => boolean;
  telegram: Pick<Telegram, "backButton" | "settingsButton">;
  // Screens inside a module or the Profile (a form, a Task's card) step back before the app does.
  nestedBack?: NestedBacks;
  onTodayShown?: () => void;
  // A pushed screen, a tab switch and Back slide, a sidebar switch fades; a launch swaps at once.
  slide?: Slide;
};

const moduleParams = z.object({ module: appModule });
const petParams = z.object({ petId: z.string() });

function reatomRoutes(base: string) {
  const root = reatomRoute(base.replaceAll("/", ""));
  const sections = root.reatomRoute("sections");

  return {
    root,
    sections,
    tabBarMenu: sections.reatomRoute("tab-bar"),
    profile: root.reatomRoute("profile"),
    pet: root.reatomRoute({ path: "pets/:petId", params: petParams }),
    module: root.reatomRoute({ path: ":module", params: moduleParams }),
  };
}

type Routes = ReturnType<typeof reatomRoutes>;

function fixedScreenOf(routes: Routes): Screen | undefined {
  const fixed = (
    [
      ["tab-bar-menu", routes.tabBarMenu],
      ["sections", routes.sections],
      ["profile", routes.profile],
    ] as const
  ).find(([, route]) => route.exact());

  return fixed === undefined ? undefined : { kind: fixed[0] };
}

// The bare base and any unknown path open the Today hub.
function moduleScreenOf(routes: Routes): Screen {
  const pet = routes.pet.exact() ? routes.pet() : null;
  const module = routes.module.exact() ? routes.module()?.module : undefined;

  if (pet !== null && pet !== undefined) {
    return { kind: "module", module: "pet", petId: pet.petId };
  }

  return module === undefined ? { kind: "today" } : { kind: "module", module };
}

function reatomScreen(routes: Routes) {
  return computed(
    (): Screen => fixedScreenOf(routes) ?? moduleScreenOf(routes),
    "navigation.screen",
  );
}

function goToNotifying(routes: Routes, onTodayShown: () => void) {
  return (screen: Screen): void => {
    goTo(routes, screen);

    if (screen.kind === "today") {
      onTodayShown();
    }
  };
}

function goTo(routes: Routes, screen: Screen): void {
  if (screen.kind === "module") {
    if (screen.petId === undefined) {
      routes.module.go({ module: screen.module }, true);
    } else {
      routes.pet.go({ petId: screen.petId }, true);
    }

    return;
  }

  const route = {
    today: routes.root,
    sections: routes.sections,
    "tab-bar-menu": routes.tabBarMenu,
    profile: routes.profile,
  }[screen.kind];

  route.go(undefined, true);
}

function rootOf(tab: NavigationTab): Screen {
  return tab === "today" || tab === "sections" || tab === "profile"
    ? { kind: tab }
    : { kind: "module", module: tab };
}

function placeScreen({ module, petId }: Place): Screen {
  return petId === undefined ? { kind: "module", module } : { kind: "module", module, petId };
}

function isSameScreen(left: Screen, right: Screen): boolean {
  if (left.kind === "module" && right.kind === "module") {
    return left.module === right.module && left.petId === right.petId;
  }

  return left.kind === right.kind;
}

function trailTo(tab: NavigationTab, screen: Screen): Screen[] {
  const root = rootOf(tab);

  return isSameScreen(root, screen) ? [] : [root];
}

// «Разделы» and the tab bar setup exist only beside a tab bar; a wide window shows Today instead.
function isTabBarScreen(screen: Screen): screen is { kind: "sections" | "tab-bar-menu" } {
  return screen.kind === "sections" || screen.kind === "tab-bar-menu";
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

type StackDependencies = {
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
function reatomStack(go: (screen: Screen) => void, dependencies: StackDependencies) {
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

type Stack = ReturnType<typeof reatomStack>;

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

function reatomOpening(stack: Stack, dependencies: OpeningDependencies) {
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

function reatomShown(screen: () => Screen) {
  return {
    shownModule: computed(() => {
      const current = screen();

      return current.kind === "module" ? current.module : undefined;
    }, "navigation.shownModule"),
    openedPetId: computed(() => {
      const current = screen();

      return current.kind === "module" ? current.petId : undefined;
    }, "navigation.openedPetId"),
  };
}

function nestedOf(
  screen: Screen,
  nestedBack: NavigationDependencies["nestedBack"],
): NestedBack | undefined {
  if (screen.kind === "module") {
    return screen.module === "feed" ? undefined : nestedBack?.[screen.module];
  }

  return screen.kind === "profile" ? nestedBack?.profile : undefined;
}

function nestedBackOf(
  screen: Screen,
  nestedBack: NavigationDependencies["nestedBack"],
): NestedBack | undefined {
  const nested = nestedOf(screen, nestedBack);

  return nested?.canGoBack() === true ? nested : undefined;
}

function isTabRoot(screen: Screen, tab: NavigationTab): boolean {
  return isSameScreen(screen, rootOf(tab));
}

function reatomBack(
  {
    screen,
    nestedBack,
    slide,
  }: { screen: () => Screen; nestedBack: NavigationDependencies["nestedBack"]; slide: Slide },
  stack: Stack,
) {
  return action(() => {
    const nested = nestedBackOf(screen(), nestedBack);

    if (nested === undefined) {
      stack.pop();
    } else if (nested.closesInPlace()) {
      // The form slides down over a screen that stays put, as a swipe or «Отмена» closes it.
      nested.back();
    } else {
      slide("back", nested.back);
    }
  }, "navigation.back").extend(() => ({
    isVisible: () =>
      nestedBackOf(screen(), nestedBack) !== undefined ||
      stack.trail().length > 0 ||
      !isTabRoot(screen(), stack.activeTab()),
  }));
}

type Following = {
  telegram: NavigationDependencies["telegram"];
  isSignedIn: () => boolean;
  isWide: () => boolean;
  screen: () => Screen;
};

type FollowedActions = {
  back: (() => void) & { isVisible: () => boolean };
  openProfile: () => void;
  landOnToday: () => void;
};

function startFollowing(
  { telegram, isSignedIn, isWide, screen }: Following,
  { back, openProfile, landOnToday }: FollowedActions,
): () => void {
  const stopBack = telegram.backButton.follow(() => isSignedIn() && back.isVisible(), back);
  const stopSettings = telegram.settingsButton.follow(isSignedIn, openProfile);
  const leavingTabBarScreens = effect(() => {
    if (isWide() && isTabBarScreen(screen())) {
      landOnToday();
    }
  }, "navigation.leavingTabBarScreens");

  return () => {
    stopBack();
    stopSettings();
    leavingTabBarScreens.unsubscribe();
  };
}

export function reatomNavigation({
  base,
  slots,
  isSignedIn,
  isWide = () => false,
  telegram,
  nestedBack,
  onTodayShown = noop,
  slide = instantly,
}: NavigationDependencies) {
  const routes = reatomRoutes(base);
  const screen = reatomScreen(routes);
  const stack = reatomStack(goToNotifying(routes, onTodayShown), {
    screen,
    slots,
    isWide,
    slide,
  });
  const back = reatomBack({ screen, nestedBack, slide }, stack);
  const opening = reatomOpening(stack, { screen, slots, isWide });

  return {
    screen,
    activeTab: stack.activeTab,
    ...reatomShown(screen),
    canGoBack: computed(() => back.isVisible(), "navigation.canGoBack"),
    back,
    openTab: stack.openTab,
    leave: stack.pop,
    launch: stack.launch,
    ...opening,

    start: () =>
      startFollowing(
        { telegram, isSignedIn, isWide, screen },
        { back, openProfile: opening.openProfile, landOnToday: stack.landOnToday },
      ),
  };
}

export type NavigationModel = ReturnType<typeof reatomNavigation>;
