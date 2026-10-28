import { action, atom, computed, reatomBoolean } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import { reatomPetArchive } from "./pet-archive.vm.ts";
import { reatomPetAvatar } from "./pet-avatar.vm.ts";
import { reatomPetMemoForm } from "./pet-memo-form.vm.ts";
import { reatomPetProfileForm } from "./pet-profile-form.vm.ts";
import {
  reatomScreen,
  titleOf,
  type Editing,
  type Navigation,
  type PetsDependencies,
} from "./pets-screen.vm.ts";

export type { PetsScreen } from "./pets-screen.vm.ts";

// The only Pet in care opens straight on its card, unless the Member asked for the whole list.
function reatomOpenedPet({ pets, route }: PetsDependencies, { isListShown }: Navigation) {
  return computed((): Pet | undefined => {
    const active = pets.active();
    const opened = (pets.list.data() ?? []).find(({ id }) => id === route.petId());

    return opened ?? (active.length === 1 && !isListShown() ? active[0] : undefined);
  }, "pets.openedPet");
}

function reatomForms(
  dependencies: PetsDependencies,
  { editing }: Navigation,
  openedPet: () => Pet | undefined,
) {
  const { route } = dependencies;
  const { haptics } = dependencies.telegram;

  function onSaved(saved: Pet): void {
    editing.set(undefined);

    if (openedPet()?.id !== saved.id) {
      route.open(saved.id);
    }
  }

  return {
    profileForm: reatomPetProfileForm({
      ...dependencies,
      today: () => dependencies.viewer().today,
      haptics,
      closingConfirmation: dependencies.telegram,
      onSaved,
    }),
    memoForm: reatomPetMemoForm({ ...dependencies, haptics, onSaved }),
  };
}

type Forms = ReturnType<typeof reatomForms>;

type Sources = Forms & {
  openedPet: () => Pet | undefined;
  archive: ReturnType<typeof reatomPetArchive>;
};

function reatomEditing(
  { editing }: Navigation,
  { profileForm, memoForm, openedPet, archive }: Sources,
) {
  function editWith(start: (pet: Pet) => void, target: Editing): void {
    const pet = openedPet();

    if (pet !== undefined) {
      start(pet);
      editing.set(target);
    }
  }

  return {
    add: action(() => {
      profileForm.startCreating();
      editing.set("profile");
    }, "pets.add"),
    editProfile: action(() => {
      editWith(profileForm.startEditing, "profile");
    }, "pets.editProfile"),
    editMemo: action(() => {
      editWith(memoForm.startEditing, "memo");
    }, "pets.editMemo"),
    startDeleting: action(() => {
      editWith(archive.resetDeletion, "delete");
    }, "pets.startDeleting"),
  };
}

// Stepping back from a Pet's card is the app's: its address is on the tab's stack. The card
// already shown, like the only Pet's, gets no second place on it.
function reatomBrowsing(
  { route }: PetsDependencies,
  { editing, isListShown }: Navigation,
  openedPet: () => Pet | undefined,
) {
  return {
    open: action((petId: string) => {
      isListShown.setFalse();

      if (openedPet()?.id !== petId) {
        route.open(petId);
      }
    }, "pets.open"),
    showAll: action(() => {
      isListShown.setTrue();
    }, "pets.showAll"),
    // The only Pet in care is the choice itself, so its card opens straight away.
    showChoice: action(() => {
      editing.set(undefined);
      isListShown.setFalse();

      if (route.petId() !== undefined) {
        route.close();
      }
    }, "pets.showChoice"),
    canGoBack: computed(() => editing() !== undefined || isListShown(), "pets.canGoBack"),
    back: action(() => {
      if (editing() === undefined) {
        isListShown.setFalse();
      } else {
        editing.set(undefined);
      }
    }, "pets.back"),
  };
}

function reatomLinks(dependencies: PetsDependencies) {
  return {
    openTask: action((taskId: string) => {
      dependencies.onOpenTask(taskId);
    }, "pets.openTask"),
    addTask: action((petId: string) => {
      dependencies.onAddTask(petId);
    }, "pets.addTask"),
  };
}

// Which screen is shown, apart from the data it shows, so a renamed Pet keeps focus where it is.
function reatomScreenKey(
  { route }: PetsDependencies,
  { editing }: Navigation,
  { openedPet, isCreating }: { openedPet: () => Pet | undefined; isCreating: () => boolean },
) {
  return computed(() => {
    const current = editing();
    const pet = route.petId() ?? openedPet()?.id ?? "list";

    if (current === "profile") {
      return isCreating() ? "new" : `${pet}:profile`;
    }

    return current === undefined ? pet : `${pet}:${current}`;
  }, "pets.screenKey");
}

export function reatomPetsScreen(dependencies: PetsDependencies) {
  const navigation: Navigation = {
    editing: atom<Editing | undefined>(undefined, "pets.editing"),
    isListShown: reatomBoolean(false, "pets.isListShown"),
  };
  const openedPet = reatomOpenedPet(dependencies, navigation);
  const forms = reatomForms(dependencies, navigation, openedPet);
  const archive = reatomPetArchive({
    ...dependencies,
    openedPet,
    haptics: dependencies.telegram.haptics,
    onDeleted: () => {
      navigation.editing.set(undefined);

      if (dependencies.route.petId() !== undefined) {
        dependencies.route.close();
      }
    },
  });
  const shown = { openedPet, isCreating: forms.profileForm.isCreating };
  const screen = reatomScreen(dependencies, navigation, shown);

  return {
    screen,
    title: computed(() => titleOf(screen()), "pets.title"),
    screenKey: reatomScreenKey(dependencies, navigation, shown),
    retry: dependencies.pets.reload,
    openedPetId: computed(() => openedPet()?.id, "pets.openedPetId"),
    isOpenedPetArchived: computed(
      () => (openedPet()?.archivedAt ?? null) !== null,
      "pets.isOpenedPetArchived",
    ),
    ...forms,
    ...archive,
    ...reatomLinks(dependencies),
    ...reatomPetAvatar({ ...dependencies, openedPet }),
    ...reatomBrowsing(dependencies, navigation, openedPet),
    ...reatomEditing(navigation, { ...forms, openedPet, archive }),
  };
}

export type PetsScreenModel = ReturnType<typeof reatomPetsScreen>;
