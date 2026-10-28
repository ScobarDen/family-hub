import { computed, type Atom, type BooleanAtom } from "@reatom/core";

import type { Pet } from "@family-hub/contract";

import type { PreparedPhoto } from "@/common/photo";
import type { ClosingConfirmation, Dialogs, Fullscreen, Haptics } from "@/common/telegram";

import type { PetsApi } from "../pets.api.ts";
import {
  toCard,
  toListItem,
  type PetCard,
  type PetListItem,
  type PetTask,
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
  telegram: Dialogs & Fullscreen & ClosingConfirmation & { haptics: Haptics };
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  tasksOf: (petId: string) => PetTask[];
  onOpenTask: (taskId: string) => void;
  onAddTask: (petId: string) => void;
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
  | { kind: "card"; card: PetCard; canDelete: boolean; archivedCount: number };

function cardOf(dependencies: PetsDependencies, pet: Pet): PetsScreen {
  const { pets, viewer, tasksOf, isFamilyOwner } = dependencies;

  return {
    kind: "card",
    card: toCard(pet, viewer(), tasksOf(pet.id)),
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

export function reatomScreen(dependencies: PetsDependencies, openedPet: () => Pet | undefined) {
  return computed((): PetsScreen => {
    if (dependencies.pets.list.data() === undefined) {
      return dependencies.pets.list.error() === undefined
        ? { kind: "loading" }
        : { kind: "failed" };
    }

    const pet = openedPet();

    return pet === undefined ? listOf(dependencies) : cardOf(dependencies, pet);
  }, "pets.screen");
}

export function titleOf(screen: PetsScreen): string {
  if (screen.kind === "card") {
    return screen.card.name;
  }

  return screen.kind === "list" ? "Питомцы" : "Питомец";
}

export function reatomFormTitles(isCreating: () => boolean) {
  return computed(
    (): Record<Editing, string> => ({
      profile: isCreating() ? "Новый питомец" : "Питомец",
      memo: "Памятка",
      delete: "Удаление питомца",
    }),
    "pets.formTitles",
  );
}
