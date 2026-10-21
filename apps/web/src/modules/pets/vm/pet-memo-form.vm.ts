import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import { petLongTextMaxLength, petMemoChange, type Pet } from "@family-hub/contract";

import type { PetsApi } from "../pets.api.ts";
import type { PetsModel } from "../pets.model.ts";
import { fill } from "./form-fill.vm.ts";

type MemoFormDependencies = {
  api: PetsApi;
  pets: Pick<PetsModel, "keep">;
  onSaved: (pet: Pet) => void;
};

const emptyMemo = { food: "", clinic: "", important: "" };

const memoText = z
  .string()
  .max(petLongTextMaxLength, `Не длиннее ${petLongTextMaxLength} символов`);

export function reatomPetMemoForm({ api, pets, onSaved }: MemoFormDependencies) {
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
    failure: computed((): string | undefined => {
      const isRejectedByServer =
        form.submit.error() !== undefined && form.validation().errors.length === 0;

      return isRejectedByServer
        ? "Не получилось сохранить памятку. Попробуйте ещё раз."
        : undefined;
    }, "pets.memoForm.failure"),

    save: action(() => {
      form.submit().catch(noop);
    }, "pets.memoForm.save"),
    startEditing: action((pet: Pet) => {
      petId.set(pet.id);
      fill(form, {
        food: pet.memo.food ?? "",
        clinic: pet.memo.clinic ?? "",
        important: pet.memo.important ?? "",
      });
    }, "pets.memoForm.startEditing"),
  };
}

export type PetMemoFormModel = ReturnType<typeof reatomPetMemoForm>;
