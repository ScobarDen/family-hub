import { readOnly } from "@/modules/changes";
import { reatomQuickAdd } from "@/modules/quick-add";
import { reatomSidebar } from "@/modules/sidebar";
import { reatomSections, reatomTabBar, reatomTabBarMenu } from "@/modules/tab-bar";

import type { Parts } from "./app.vm.ts";
import type { AppRouting } from "./routing.vm.ts";
import type { Screens } from "./screens.vm.ts";

// The Pets are named after the Family's only Pet, in the tab bar and the sidebar alike.
function titlesOf({ shared }: Parts) {
  return () => {
    const petTitle = shared.petsModel.tabTitle();

    return petTitle === undefined ? {} : { pet: petTitle };
  };
}

function reatomNavigationBars(
  parts: Parts,
  { navigation }: AppRouting,
  quickAdd: ReturnType<typeof reatomQuickAdd>,
) {
  const { telegram } = parts.dependencies;
  const modules = parts.shared.tabBarModules;
  const titles = titlesOf(parts);

  return {
    tabBar: reatomTabBar({
      modules,
      activeTab: navigation.activeTab,
      onOpen: navigation.openTab,
      telegram,
      titles,
    }),
    sidebar: reatomSidebar({
      slots: modules.modules,
      activeTab: navigation.activeTab,
      onOpen: navigation.openTab,
      onAdd: quickAdd.open,
      telegram,
      titles,
    }),
  };
}

export function reatomShell(parts: Parts, routing: AppRouting, today: Screens["today"]) {
  const { dependencies, shared } = parts;
  const { navigation, opener } = routing;
  const { telegram } = dependencies;
  const modules = shared.tabBarModules;
  const quickAdd = reatomQuickAdd({
    contributionGoalId: today.nearestGoalId,
    canAddPhoto: () => shared.photoStorage.view()?.isConnected === true,
    onQuickAdd: opener.open,
    onAddPhotos: opener.uploadPhotos,
    telegram,
  });

  return {
    isWide: readOnly(dependencies.isWide),
    navigation,
    ...reatomNavigationBars(parts, routing, quickAdd),
    tabBarMenu: reatomTabBarMenu({ modules, telegram }),
    quickAdd,
    sections: reatomSections({
      modules,
      onOpen: navigation.openModule,
      onConfigure: navigation.openTabBarMenu,
      onOpenSettings: navigation.openProfile,
    }),
  };
}
