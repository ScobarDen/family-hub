import { action, atom, computed, noop, reatomRoute, type Atom } from "@reatom/core";
import { z } from "zod";

import { appModule, type AppModule, type SlotModule } from "@family-hub/contract";

import { instantly, type Slide } from "@/common/state";
import type { Telegram } from "@/common/telegram";
import type { TabId } from "@/modules/tab-bar";

export type Place = { module: AppModule; petId?: string };

export type Screen =
  | { kind: "today" }
  | { kind: "sections" }
  | { kind: "tab-bar-menu" }
  | { kind: "profile" }
  | { kind: "module"; module: AppModule; petId?: string };

type NestedBack = { canGoBack: () => boolean; isFormOpen: () => boolean; back: () => void };

type NavigationDependencies = {
  base: string;
  slots: () => SlotModule[];
  isSignedIn: () => boolean;
  telegram: Pick<Telegram, "backButton" | "settingsButton">;
  // Screens inside a module or the Profile (a form, a Task's card) step back before the app does.
  nestedBack?: Partial<Record<AppModule | "profile", NestedBack>>;
  onTodayShown?: () => void;
  // A pushed screen, a tab switch and Back slide; a launch swaps at once.
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

function rootOf(tab: TabId): Screen {
  return tab === "today" || tab === "sections" ? { kind: tab } : { kind: "module", module: tab };
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

// A reload lands on the tab whose root it is, or on top of the hub.
function initialTabOf(screen: Screen, slots: SlotModule[]): TabId {
  if (screen.kind === "sections" || screen.kind === "tab-bar-menu") {
    return "sections";
  }

  const slot = slots.find((module) => screen.kind === "module" && module === screen.module);

  return slot !== undefined && screen.kind === "module" && screen.petId === undefined
    ? slot
    : "today";
}

// Each tab is a stack: a section opens on top of the current tab (a slot's opens its tab), Back
// pops it, a tab tap goes to that tab's root. The stack lives in memory; the URL names only its
// top screen.
function reatomStack(
  go: (screen: Screen) => void,
  { screen, slots, slide }: { screen: () => Screen; slots: () => SlotModule[]; slide: Slide },
) {
  const tab = atom<TabId | undefined>(undefined, "navigation.tab");
  const trail = atom<Screen[]>([], "navigation.trail");
  const activeTab = computed(
    () => tab() ?? initialTabOf(screen(), slots()),
    "navigation.activeTab",
  );

  return {
    activeTab,
    trail,
    push: action((next: Screen) => {
      const current = screen();

      if (!isSameScreen(current, next)) {
        slide("forward", () => {
          tab.set(activeTab());
          trail.set([...trail(), current]);
          go(next);
        });
      }
    }, "navigation.push"),
    openTab: reatomOpenTab(go, { tab, trail, screen, slide }),
    // A launch link opens on top of the hub, whatever the slots are.
    launch: action((place: Place | undefined) => {
      tab.set("today");
      trail.set(place === undefined ? [] : [{ kind: "today" }]);
      go(place === undefined ? { kind: "today" } : placeScreen(place));
    }, "navigation.launch"),
    pop: reatomPop(go, { trail, activeTab, slide }),
  };
}

function reatomOpenTab(
  go: (screen: Screen) => void,
  {
    tab,
    trail,
    screen,
    slide,
  }: { tab: Atom<TabId | undefined>; trail: Atom<Screen[]>; screen: () => Screen; slide: Slide },
) {
  return action((next: TabId) => {
    const root = rootOf(next);

    function open() {
      tab.set(next);
      trail.set([]);
      go(root);
    }

    if (isSameScreen(screen(), root)) {
      open();
    } else {
      slide("forward", open);
    }
  }, "navigation.openTab");
}

function reatomPop(
  go: (screen: Screen) => void,
  { trail, activeTab, slide }: { trail: Atom<Screen[]>; activeTab: () => TabId; slide: Slide },
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

// A section in a slot opens its own tab, so the highlighted tab is always the one on screen and
// the section's one state lives in one stack; any other section goes on top of the current tab.
function reatomOpening(
  stack: Stack,
  { screen, slots }: { screen: () => Screen; slots: () => SlotModule[] },
) {
  function place(next: Place) {
    const slot = slots().find((module) => module === next.module);

    if (slot !== undefined && next.petId === undefined) {
      stack.openTab(slot);
    } else {
      stack.push(placeScreen(next));
    }
  }

  return {
    open: action((next: Place) => {
      place(next);
    }, "navigation.open"),
    openModule: action((module: AppModule) => {
      place({ module });
    }, "navigation.openModule"),
    openPet: action((petId: string) => {
      stack.push({ kind: "module", module: "pet", petId });
    }, "navigation.openPet"),
    openTabBarMenu: action(() => {
      stack.push({ kind: "tab-bar-menu" });
    }, "navigation.openTabBarMenu"),
    openProfile: action(() => {
      if (screen().kind !== "profile") {
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
    return nestedBack?.[screen.module];
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

function isTabRoot(screen: Screen, tab: TabId): boolean {
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
    } else if (nested.isFormOpen()) {
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

export function reatomNavigation({
  base,
  slots,
  isSignedIn,
  telegram,
  nestedBack,
  onTodayShown = noop,
  slide = instantly,
}: NavigationDependencies) {
  const routes = reatomRoutes(base);
  const screen = reatomScreen(routes);
  const stack = reatomStack(goToNotifying(routes, onTodayShown), { screen, slots, slide });
  const back = reatomBack({ screen, nestedBack, slide }, stack);
  const opening = reatomOpening(stack, { screen, slots });

  return {
    screen,
    activeTab: stack.activeTab,
    hasProfileButton: !telegram.settingsButton.isAvailable,
    ...reatomShown(screen),
    canGoBack: computed(() => back.isVisible(), "navigation.canGoBack"),
    back,
    openTab: stack.openTab,
    leave: stack.pop,
    launch: stack.launch,
    ...opening,

    start(): () => void {
      const stopBack = telegram.backButton.follow(() => isSignedIn() && back.isVisible(), back);
      const stopSettings = telegram.settingsButton.follow(isSignedIn, opening.openProfile);

      return () => {
        stopBack();
        stopSettings();
      };
    },
  };
}

export type NavigationModel = ReturnType<typeof reatomNavigation>;
