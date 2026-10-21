import { action, atom, computed, reatomRoute } from "@reatom/core";
import { z } from "zod";

import { appModule, parseDeepLink, type AppModule, type DeepLinkKind } from "@family-hub/contract";

import type { Telegram } from "@/common/telegram";

export type Screen =
  | { kind: "module"; module: AppModule; isOnTabBar: boolean }
  | { kind: "profile" }
  | { kind: "tab-bar-menu" };

type NestedBack = { canGoBack: () => boolean; back: () => void };

type NavigationDependencies = {
  base: string;
  tabBar: () => AppModule[];
  isSignedIn: () => boolean;
  telegram: Pick<Telegram, "startParam" | "backButton" | "settingsButton">;
  // Screens inside a module (a Pet's card among several, a form) step back before the app does.
  nestedBack?: Partial<Record<AppModule, NestedBack>>;
};

const deepLinkModules: Partial<Record<DeepLinkKind, AppModule>> = {
  pet: "pet",
  entry: "pet",
  event: "calendar",
  goal: "goals",
  plan: "plans",
};

const moduleParams = z.object({ module: appModule });

function reatomRoutes(base: string) {
  const root = reatomRoute(base.replaceAll("/", ""));
  const profile = root.reatomRoute("profile");

  return {
    root,
    tab: root.reatomRoute({ path: ":module", params: moduleParams }),
    profile,
    tabBarMenu: profile.reatomRoute("tab-bar"),
    hiddenModule: profile.reatomRoute({ path: "modules/:module", params: moduleParams }),
  };
}

type Routes = ReturnType<typeof reatomRoutes>;

function exactModule(route: Routes["tab"]): AppModule | undefined {
  return route.exact() ? route()?.module : undefined;
}

// The bare base and any unknown path open the first tab.
function reatomScreen(routes: Routes, tabBar: () => AppModule[]) {
  return computed((): Screen => {
    const hiddenModule = exactModule(routes.hiddenModule);

    if (routes.tabBarMenu.exact()) {
      return { kind: "tab-bar-menu" };
    }

    if (hiddenModule !== undefined) {
      return { kind: "module", module: hiddenModule, isOnTabBar: false };
    }

    if (routes.profile.exact()) {
      return { kind: "profile" };
    }

    const [firstModule = "feed"] = tabBar();
    const module = exactModule(routes.tab) ?? firstModule;

    // A deep link may open a module the Member hid; their tab bar may also arrive after it.
    return { kind: "module", module, isOnTabBar: tabBar().includes(module) };
  }, "navigation.screen");
}

function isOffTabBar(screen: Screen): boolean {
  return screen.kind !== "module" || !screen.isOnTabBar;
}

function nestedBackOf(
  screen: Screen,
  nestedBack: NavigationDependencies["nestedBack"],
): NestedBack | undefined {
  const nested = screen.kind === "module" ? nestedBack?.[screen.module] : undefined;

  return nested?.canGoBack() === true ? nested : undefined;
}

function reatomMoves(routes: Routes, tabBar: () => AppModule[]) {
  const lastTab = atom<AppModule | undefined>(undefined, "navigation.lastTab");

  return {
    openModule: action((module: AppModule) => {
      if (tabBar().includes(module)) {
        lastTab.set(module);
        routes.tab.go({ module });
      } else {
        routes.hiddenModule.go({ module });
      }
    }, "navigation.openModule"),
    openProfile: action(() => {
      if (!routes.profile.match()) {
        routes.profile.go();
      }
    }, "navigation.openProfile"),
    openTabBarMenu: action(() => {
      routes.tabBarMenu.go();
    }, "navigation.openTabBarMenu"),
    openDeepLink: action((startParameter: string | undefined) => {
      const link = parseDeepLink(startParameter);
      const module = link === undefined ? undefined : deepLinkModules[link.kind];

      if (module !== undefined) {
        lastTab.set(module);
        routes.tab.go({ module }, true);
      }
    }, "navigation.openDeepLink"),
    leaveProfile: action(() => {
      const module = lastTab();

      if (module === undefined || !tabBar().includes(module)) {
        routes.root.go();
      } else {
        routes.tab.go({ module });
      }
    }, "navigation.leaveProfile"),
  };
}

type BackSources = {
  screen: () => Screen;
  nestedBack: NavigationDependencies["nestedBack"];
  leaveProfile: () => void;
  goToProfile: () => void;
};

function reatomBack({ screen, nestedBack, leaveProfile, goToProfile }: BackSources) {
  return action(() => {
    const nested = nestedBackOf(screen(), nestedBack);

    if (nested !== undefined) {
      nested.back();
    } else if (screen().kind === "profile") {
      leaveProfile();
    } else {
      goToProfile();
    }
  }, "navigation.back").extend(() => ({
    isVisible: () => isOffTabBar(screen()) || nestedBackOf(screen(), nestedBack) !== undefined,
  }));
}

export function reatomNavigation({
  base,
  tabBar,
  isSignedIn,
  telegram,
  nestedBack,
}: NavigationDependencies) {
  const routes = reatomRoutes(base);
  const screen = reatomScreen(routes, tabBar);
  const { leaveProfile, openDeepLink, ...moves } = reatomMoves(routes, tabBar);
  const back = reatomBack({
    screen,
    nestedBack,
    leaveProfile,
    goToProfile: () => {
      routes.profile.go();
    },
  });

  return {
    screen,
    activeModule: computed(() => {
      const current = screen();

      return current.kind === "module" && current.isOnTabBar ? current.module : undefined;
    }, "navigation.activeModule"),
    hasProfileButton: !telegram.settingsButton.isAvailable,
    ...moves,

    // telegram.startParam was read when the wrapper was built, before this first navigation.
    start(): () => void {
      openDeepLink(telegram.startParam);

      const stopBack = telegram.backButton.follow(() => isSignedIn() && back.isVisible(), back);
      const stopSettings = telegram.settingsButton.follow(isSignedIn, moves.openProfile);

      return () => {
        stopBack();
        stopSettings();
      };
    },
  };
}

export type NavigationModel = ReturnType<typeof reatomNavigation>;
