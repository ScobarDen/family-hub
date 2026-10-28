import { action, computed } from "@reatom/core";

import { reatomCare, type CareApi, type CareDependencies } from "../care/index.ts";
import type { PetsDependencies } from "./pets-screen.vm.ts";
import { reatomPetsScreen } from "./pets.vm.ts";

type WiredInside =
  | "api"
  | "petId"
  | "today"
  | "timeZone"
  | "isReadOnly"
  | "onMakeAvatar"
  | "onOpenPet";

export type PetTabDependencies = PetsDependencies &
  Omit<CareDependencies, WiredInside> & {
    careApi: CareApi;
  };

// The care journal opens over the pet card, so its forms come first on the way back.
export function reatomPetTab({ careApi, ...dependencies }: PetTabDependencies) {
  const { viewer } = dependencies;
  const pets = reatomPetsScreen(dependencies);
  const care = reatomCare({
    ...dependencies,
    api: careApi,
    petId: () => pets.openedPetId(),
    today: () => viewer().today,
    timeZone: () => viewer().timeZone,
    isReadOnly: () => pets.isOpenedPetArchived(),
    onMakeAvatar: (photoId) => {
      pets.makeAvatar(photoId);
    },
    onOpenPet: pets.open,
  });

  return {
    pets,
    care,
    title: computed(() => care.title() ?? pets.title(), "petTab.title"),
    screenKey: computed(() => `${pets.screenKey()}:${care.screen().kind}`, "petTab.screenKey"),
    nextVisit: computed(() => {
      const screen = pets.screen();

      return screen.kind === "card" ? screen.card.nextVisit : undefined;
    }, "petTab.nextVisit"),
    canGoBack: computed(() => care.canGoBack() || pets.canGoBack(), "petTab.canGoBack"),
    isFormOpen: computed(
      () => (care.canGoBack() ? care.isFormOpen() : pets.isFormOpen()),
      "petTab.isFormOpen",
    ),
    back: action(() => {
      if (care.canGoBack()) {
        care.back();
      } else {
        pets.back();
      }
    }, "petTab.back"),
  };
}

export type PetTabModel = ReturnType<typeof reatomPetTab>;
