import { action, atom, computed, type Atom } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import type { PetsApi } from "../pets.api.ts";
import {
  toCard,
  toListItem,
  type PetCard,
  type PetListItem,
  type SoonSource,
  type Viewer,
} from "../pets.lib.ts";
import type { PetsModel } from "../pets.model.ts";
import { reatomPetMemoForm } from "./pet-memo-form.vm.ts";
import { reatomPetProfileForm } from "./pet-profile-form.vm.ts";

export type PetsScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "empty" }
  | { kind: "list"; pets: PetListItem[] }
  | { kind: "card"; card: PetCard }
  | { kind: "profile-form"; isCreating: boolean }
  | { kind: "memo-form" };

type Editing = "profile" | "memo";

type PetsDependencies = {
  api: PetsApi;
  pets: PetsModel;
  viewer: () => Viewer;
  photoHint: () => string | undefined;
  soonPlans: (petId: string) => SoonSource[];
  onOpenPlan: (planId: string) => void;
  onPlan: (petId: string) => void;
};

type Navigation = {
  editing: Atom<Editing | undefined>;
  openedPetId: Atom<string | undefined>;
};

function reatomOpenedPet({ pets }: PetsDependencies, { openedPetId }: Navigation) {
  return computed((): Pet | undefined => {
    const active = pets.active();

    return active.length === 1 ? active[0] : active.find(({ id }) => id === openedPetId());
  }, "pets.openedPet");
}

function reatomScreen(
  { pets, viewer, soonPlans }: PetsDependencies,
  { editing }: Navigation,
  { openedPet, isCreating }: { openedPet: () => Pet | undefined; isCreating: () => boolean },
) {
  return computed((): PetsScreen => {
    const current = editing();

    if (current === "profile") {
      return { kind: "profile-form", isCreating: isCreating() };
    }

    if (current === "memo") {
      return { kind: "memo-form" };
    }

    if (pets.list.error() !== undefined) {
      return { kind: "failed" };
    }

    if (pets.list.data() === undefined) {
      return { kind: "loading" };
    }

    const pet = openedPet();

    if (pet !== undefined) {
      return { kind: "card", card: toCard(pet, viewer(), soonPlans(pet.id)) };
    }

    const active = pets.active();

    return active.length === 0
      ? { kind: "empty" }
      : { kind: "list", pets: active.map((item) => toListItem(item, viewer())) };
  }, "pets.screen");
}

const screenTitles: Partial<Record<PetsScreen["kind"], string>> = {
  list: "Питомцы",
  "memo-form": "Памятка",
};

function titleOf(screen: PetsScreen): string {
  if (screen.kind === "card") {
    return screen.card.name;
  }

  if (screen.kind === "profile-form") {
    return screen.isCreating ? "Новый питомец" : "Питомец";
  }

  return screenTitles[screen.kind] ?? "Питомец";
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

function reatomMoves(
  { editing, openedPetId }: Navigation,
  { profileForm, memoForm, openedPet }: Forms & { openedPet: () => Pet | undefined },
) {
  return {
    open: action((petId: string) => {
      openedPetId.set(petId);
    }, "pets.open"),
    add: action(() => {
      profileForm.startCreating();
      editing.set("profile");
    }, "pets.add"),
    editProfile: action(() => {
      const pet = openedPet();

      if (pet !== undefined) {
        profileForm.startEditing(pet);
        editing.set("profile");
      }
    }, "pets.editProfile"),
    editMemo: action(() => {
      const pet = openedPet();

      if (pet !== undefined) {
        memoForm.startEditing(pet);
        editing.set("memo");
      }
    }, "pets.editMemo"),
    back: action(() => {
      if (editing() === undefined) {
        openedPetId.set(undefined);
      } else {
        editing.set(undefined);
      }
    }, "pets.back"),
  };
}

export function reatomPetsScreen(dependencies: PetsDependencies) {
  const navigation: Navigation = {
    editing: atom<Editing | undefined>(undefined, "pets.editing"),
    openedPetId: atom<string | undefined>(undefined, "pets.openedPetId"),
  };
  const forms = reatomForms(dependencies, navigation);
  const openedPet = reatomOpenedPet(dependencies, navigation);
  const screen = reatomScreen(dependencies, navigation, {
    openedPet,
    isCreating: forms.profileForm.isCreating,
  });

  return {
    screen,
    title: computed(() => titleOf(screen()), "pets.title"),
    openedPetId: computed(() => {
      const current = screen();

      return current.kind === "card" ? current.card.id : undefined;
    }, "pets.openedPetId"),
    photoHint: computed(() => dependencies.photoHint(), "pets.photoHint"),
    openPlan: action((planId: string) => {
      dependencies.onOpenPlan(planId);
    }, "pets.openPlan"),
    plan: action((petId: string) => {
      dependencies.onPlan(petId);
    }, "pets.plan"),
    ...forms,
    canGoBack: computed(
      () =>
        navigation.editing() !== undefined ||
        (navigation.openedPetId() !== undefined && dependencies.pets.active().length > 1),
      "pets.canGoBack",
    ),
    ...reatomMoves(navigation, { ...forms, openedPet }),
  };
}

export type PetsScreenModel = ReturnType<typeof reatomPetsScreen>;
