import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import { petLongTextMaxLength, petMemoChange, type Pet } from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/modules/form";
import type { Haptics } from "@/modules/telegram";

import type { PetsApi } from "../pets.api.ts";
import type { PetsModel } from "../pets.model.ts";

type MemoFormDependencies = {
  api: PetsApi;
  pets: Pick<PetsModel, "keep">;
  haptics: Pick<Haptics, "success" | "error">;
  onSaved: (pet: Pet) => void;
};

const emptyMemo = { food: "", clinic: "", important: "" };

const memoText = z
  .string()
  .max(petLongTextMaxLength, `Не длиннее ${petLongTextMaxLength} символов`);

export function reatomPetMemoForm({ api, pets, haptics, onSaved }: MemoFormDependencies) {
  const petId = atom<string | undefined>(undefined, "pets.memoForm.petId");
  const form = reatomForm(emptyMemo, {
    name: "pets.memoForm",
    schema: z.object({ food: memoText, clinic: memoText, important: memoText }),
    onSubmit: async (values: typeof emptyMemo) => {
      const id = petId();

      if (id === undefined) {
        return;
      }

      const saved = await wrap(api.saveMemo(id, petMemoChange.parse(values)));

      pets.keep(saved);
      onSaved(saved);
    },
  });

  return {
    form,
    isSaving: computed(() => !form.submit.ready(), "pets.memoForm.isSaving"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить памятку. Попробуйте ещё раз.",
      name: "pets.memoForm.failure",
      haptics,
    }),

    save: action(() => {
      form.submit().then(haptics.success, noop);
    }, "pets.memoForm.save"),
    startEditing: action((pet: Pet) => {
      petId.set(pet.id);
      fillForm(form, {
        food: pet.memo.food ?? "",
        clinic: pet.memo.clinic ?? "",
        important: pet.memo.important ?? "",
      });
    }, "pets.memoForm.startEditing"),
  };
}

export type PetMemoFormModel = ReturnType<typeof reatomPetMemoForm>;
