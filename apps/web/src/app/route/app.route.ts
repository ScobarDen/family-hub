import { computed, effect, noop } from "@reatom/core";

import type { SlotModule } from "@family-hub/contract";

import { instantly, type Slide } from "@/modules/changes";
import type { Telegram } from "@/modules/telegram";

import { reatomBack, type NestedBacks } from "./back.route.ts";
import { reatomOpening } from "./opening.route.ts";
import {
  goToNotifying,
  isTabBarScreen,
  reatomRoutes,
  reatomScreen,
  type Screen,
} from "./screen.route.ts";
import { reatomStack } from "./tab-stack.route.ts";

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
