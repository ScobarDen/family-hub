import { action, computed, reatomForm, withAsync, wrap } from "@reatom/core";
import { z } from "zod";

import type { Pet } from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";
import { detached, reatomFailure } from "@/common/state";

import type { PetsApi } from "../pets.api.ts";
import type { PetsModel } from "../pets.model.ts";

type PetArchiveDependencies = {
  api: PetsApi;
  pets: Pick<PetsModel, "keep" | "drop">;
  openedPet: () => Pet | undefined;
  onDeleted: () => void;
};

function reatomDeletion({ api, pets, openedPet, onDeleted }: PetArchiveDependencies) {
  const petName = z
    .string()
    .refine(
      (typed) => typed.trim() !== "" && typed.trim() === openedPet()?.name.trim(),
      "Имя не совпадает",
    );

  return reatomForm(
    { petName: "" },
    {
      name: "pets.deletion",
      schema: z.object({ petName }),
      onSubmit: async (values) => {
        const pet = openedPet();

        if (pet === undefined) {
          return;
        }

        await wrap(api.remove(pet.id, values.petName));
        pets.drop(pet.id);
        onDeleted();
      },
    },
  );
}

// Archiving is any Member's and undone as easily; deleting forever is the Family Owner's alone.
export function reatomPetArchive(dependencies: PetArchiveDependencies) {
  const { api, pets, openedPet } = dependencies;
  const deletion = reatomDeletion(dependencies);
  const toggle = action(async () => {
    const pet = openedPet();

    if (pet === undefined) {
      return;
    }

    pets.keep(await wrap(pet.archivedAt === null ? api.archive(pet.id) : api.unarchive(pet.id)));
  }, "pets.archive.toggle").extend(withAsync());

  return {
    deletion,
    isDeleting: computed(() => !deletion.submit.ready(), "pets.archive.isDeleting"),
    deletionFailure: reatomSubmitFailure(deletion, {
      message: "Не получилось удалить питомца. Попробуйте ещё раз.",
      name: "pets.archive.deletionFailure",
    }),
    archiveFailure: reatomFailure(toggle, {
      message: "Не получилось. Попробуйте ещё раз.",
      name: "pets.archive.failure",
    }),

    toggleArchive: detached(toggle, "pets.archive.toggleArchive"),
    resetDeletion: action(() => {
      fillForm(deletion, { petName: "" });
    }, "pets.archive.resetDeletion"),
    deletePet: detached(deletion.submit, "pets.archive.deletePet"),
  };
}

export type PetArchiveModel = ReturnType<typeof reatomPetArchive>;
