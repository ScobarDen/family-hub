import { readOnly } from "@/modules/changes";
import { reatomQuickAdd } from "@/modules/quick-add";
import { reatomSections, reatomTabBar, reatomTabBarMenu } from "@/modules/tab-bar";

import type { Parts } from "./app.vm.ts";
import type { AppRouting } from "./routing.vm.ts";
import type { Screens } from "./screens.vm.ts";

export function reatomShell(
  { dependencies, shared }: Parts,
  { navigation, opener }: AppRouting,
  today: Screens["today"],
) {
  const { telegram } = dependencies;
  const modules = shared.tabBarModules;

  return {
    isWide: readOnly(dependencies.isWide),
    navigation,
    tabBar: reatomTabBar({
      modules,
      activeTab: navigation.activeTab,
      onOpen: navigation.openTab,
      telegram,
      titles: () => {
        const petTitle = shared.petsModel.tabTitle();

        return petTitle === undefined ? {} : { pet: petTitle };
      },
    }),
    tabBarMenu: reatomTabBarMenu({ modules, telegram }),
    quickAdd: reatomQuickAdd({
      contributionGoalId: today.nearestGoalId,
      canAddPhoto: () => shared.photoStorage.view()?.isConnected === true,
      onQuickAdd: opener.open,
      onAddPhotos: opener.uploadPhotos,
      telegram,
    }),
    sections: reatomSections({
      modules,
      onOpen: navigation.openModule,
      onConfigure: navigation.openTabBarMenu,
      onOpenSettings: navigation.openProfile,
    }),
  };
}
