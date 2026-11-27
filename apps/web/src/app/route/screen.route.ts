import { computed, reatomRoute } from "@reatom/core";
import { z } from "zod";

import { appModule, type AppModule } from "@family-hub/contract";

import type { NavigationTab } from "@/modules/sections";

export type Place = { module: AppModule; petId?: string };

export type Screen =
  | { kind: "today" }
  | { kind: "sections" }
  | { kind: "tab-bar-menu" }
  | { kind: "profile" }
  | { kind: "module"; module: AppModule; petId?: string };

const moduleParams = z.object({ module: appModule });
const petParams = z.object({ petId: z.string() });

export function reatomRoutes(base: string) {
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

export function reatomScreen(routes: Routes) {
  return computed(
    (): Screen => fixedScreenOf(routes) ?? moduleScreenOf(routes),
    "navigation.screen",
  );
}

export function goToNotifying(routes: Routes, onTodayShown: () => void) {
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

export function rootOf(tab: NavigationTab): Screen {
  return tab === "today" || tab === "sections" || tab === "profile"
    ? { kind: tab }
    : { kind: "module", module: tab };
}

export function placeScreen({ module, petId }: Place): Screen {
  return petId === undefined ? { kind: "module", module } : { kind: "module", module, petId };
}

export function isSameScreen(left: Screen, right: Screen): boolean {
  if (left.kind === "module" && right.kind === "module") {
    return left.module === right.module && left.petId === right.petId;
  }

  return left.kind === right.kind;
}

export function isTabRoot(screen: Screen, tab: NavigationTab): boolean {
  return isSameScreen(screen, rootOf(tab));
}

// «Разделы» and the tab bar setup exist only beside a tab bar; a wide window shows Today instead.
export function isTabBarScreen(screen: Screen): screen is { kind: "sections" | "tab-bar-menu" } {
  return screen.kind === "sections" || screen.kind === "tab-bar-menu";
}
