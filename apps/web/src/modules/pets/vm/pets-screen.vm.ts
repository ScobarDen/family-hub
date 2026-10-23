import { computed, type Atom, type BooleanAtom } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import type { PetsApi } from "../pets.api.ts";
import {
  toCard,
  toListItem,
  type PetCard,
  type PetListItem,
  type SoonSource,
  type SoonTarget,
  type Viewer,
} from "../pets.lib.ts";
import type { PetsModel } from "../pets.model.ts";

export type Editing = "profile" | "memo" | "delete";

// A Pet's card has its own address, so Back, a deep link and a reload land on the same Pet.
export type PetRoute = {
  petId: () => string | undefined;
  open: (petId: string) => void;
  close: () => void;
};

export type PetsDependencies = {
  api: PetsApi;
  route: PetRoute;
  pets: PetsModel;
  viewer: () => Viewer;
  isFamilyOwner: () => boolean;
  soon: (petId: string) => SoonSource[];
  onOpenSoon: (target: SoonTarget) => void;
  onPlan: (petId: string) => void;
};

export type Navigation = {
  editing: Atom<Editing | undefined>;
  isListShown: BooleanAtom;
};

export type PetsScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "empty"; archived: PetListItem[] }
  | { kind: "list"; pets: PetListItem[]; archived: PetListItem[] }
  | { kind: "card"; card: PetCard; canDelete: boolean; archivedCount: number }
  | { kind: "profile-form"; isCreating: boolean }
  | { kind: "memo-form" }
  | { kind: "delete-form" };

const editingScreens: Record<Exclude<Editing, "profile">, PetsScreen> = {
  memo: { kind: "memo-form" },
  delete: { kind: "delete-form" },
};

function cardOf(dependencies: PetsDependencies, pet: Pet): PetsScreen {
  const { pets, viewer, soon, isFamilyOwner } = dependencies;

  return {
    kind: "card",
    card: toCard(pet, viewer(), soon(pet.id)),
    canDelete: isFamilyOwner() && pet.archivedAt !== null,
    archivedCount: pets.archived().length,
  };
}

function listOf({ pets, viewer }: PetsDependencies): PetsScreen {
  const archived = pets.archived().map((item) => toListItem(item, viewer()));
  const active = pets.active();

  return active.length === 0
    ? { kind: "empty", archived }
    : { kind: "list", pets: active.map((item) => toListItem(item, viewer())), archived };
}

export function reatomScreen(
  dependencies: PetsDependencies,
  { editing }: Navigation,
  { openedPet, isCreating }: { openedPet: () => Pet | undefined; isCreating: () => boolean },
) {
  return computed((): PetsScreen => {
    const current = editing();

    if (current === "profile") {
      return { kind: "profile-form", isCreating: isCreating() };
    }

    if (current !== undefined) {
      return editingScreens[current];
    }

    if (dependencies.pets.list.error() !== undefined) {
      return { kind: "failed" };
    }

    if (dependencies.pets.list.data() === undefined) {
      return { kind: "loading" };
    }

    const pet = openedPet();

    return pet === undefined ? listOf(dependencies) : cardOf(dependencies, pet);
  }, "pets.screen");
}

const screenTitles: Partial<Record<PetsScreen["kind"], string>> = {
  list: "Питомцы",
  "memo-form": "Памятка",
  "delete-form": "Удаление питомца",
};

export function titleOf(screen: PetsScreen): string {
  if (screen.kind === "card") {
    return screen.card.name;
  }

  if (screen.kind === "profile-form") {
    return screen.isCreating ? "Новый питомец" : "Питомец";
  }

  return screenTitles[screen.kind] ?? "Питомец";
}
