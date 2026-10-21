import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import type { SoonKind } from "../pets.lib.ts";
import { reatomPetArchive } from "./pet-archive.vm.ts";
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
function reatomOpenedPet({ pets }: PetsDependencies, { openedPetId, isListShown }: Navigation) {
  return computed((): Pet | undefined => {
    const active = pets.active();
    const opened = (pets.list.data() ?? []).find(({ id }) => id === openedPetId());

    return opened ?? (active.length === 1 && !isListShown() ? active[0] : undefined);
  }, "pets.openedPet");
}

function reatomForms(dependencies: PetsDependencies, { editing, openedPetId }: Navigation) {
  function onSaved(saved: Pet): void {
    editing.set(undefined);
    openedPetId.set(saved.id);
  }

  return {
    profileForm: reatomPetProfileForm({
      ...dependencies,
      today: () => dependencies.viewer().today,
      onSaved,
    }),
    memoForm: reatomPetMemoForm({ ...dependencies, onSaved }),
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

function reatomBrowsing(
  { pets }: PetsDependencies,
  { editing, openedPetId, isListShown }: Navigation,
) {
  // Leaving the only Pet's card would show the same card again, so there is nothing to go back to.
  const isOnlyPetOpened = computed(() => {
    const active = pets.active();

    return active.length === 1 && active[0]?.id === openedPetId();
  }, "pets.isOnlyPetOpened");

  return {
    open: action((petId: string) => {
      openedPetId.set(petId);
    }, "pets.open"),
    showAll: action(() => {
      isListShown.set(true);
    }, "pets.showAll"),
    canGoBack: computed(
      () =>
        editing() !== undefined ||
        isListShown() ||
        (openedPetId() !== undefined && !isOnlyPetOpened()),
      "pets.canGoBack",
    ),
    back: action(() => {
      if (editing() !== undefined) {
        editing.set(undefined);
      } else if (openedPetId() === undefined) {
        isListShown.set(false);
      } else {
        openedPetId.set(undefined);
      }
    }, "pets.back"),
  };
}

function reatomLinks(dependencies: PetsDependencies) {
  return {
    openSoon: action((item: { id: string; kind: SoonKind }) => {
      dependencies.onOpenSoon(item);
    }, "pets.openSoon"),
    plan: action((petId: string) => {
      dependencies.onPlan(petId);
    }, "pets.plan"),
  };
}

// The avatar is picked in the care module's photo viewer; the Pet's card only shows it.
function reatomAvatar({ api, pets }: PetsDependencies, openedPet: () => Pet | undefined) {
  const save = action(async (photoId: string) => {
    const pet = openedPet();

    if (pet !== undefined) {
      pets.keep(await wrap(api.setAvatar(pet.id, photoId)));
    }
  }, "pets.saveAvatar").extend(withAsync());

  return {
    makeAvatar: action((photoId: string) => {
      save(photoId).catch(noop);
    }, "pets.makeAvatar"),
  };
}

export function reatomPetsScreen(dependencies: PetsDependencies) {
  const navigation: Navigation = {
    editing: atom<Editing | undefined>(undefined, "pets.editing"),
    openedPetId: atom<string | undefined>(undefined, "pets.openedPetId"),
    isListShown: atom(false, "pets.isListShown"),
  };
  const forms = reatomForms(dependencies, navigation);
  const openedPet = reatomOpenedPet(dependencies, navigation);
  const archive = reatomPetArchive({
    ...dependencies,
    openedPet,
    onDeleted: () => {
      navigation.editing.set(undefined);
      navigation.openedPetId.set(undefined);
    },
  });
  const screen = reatomScreen(dependencies, navigation, {
    openedPet,
    isCreating: forms.profileForm.isCreating,
  });

  return {
    screen,
    title: computed(() => titleOf(screen()), "pets.title"),
    openedPetId: computed(() => openedPet()?.id, "pets.openedPetId"),
    isOpenedPetArchived: computed(
      () => (openedPet()?.archivedAt ?? null) !== null,
      "pets.isOpenedPetArchived",
    ),
    ...forms,
    ...archive,
    ...reatomLinks(dependencies),
    ...reatomAvatar(dependencies, openedPet),
    ...reatomBrowsing(dependencies, navigation),
    ...reatomEditing(navigation, { ...forms, openedPet, archive }),
  };
}

export type PetsScreenModel = ReturnType<typeof reatomPetsScreen>;
