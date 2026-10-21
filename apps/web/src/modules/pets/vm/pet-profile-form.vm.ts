import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import {
  petLongTextMaxLength,
  petNameMaxLength,
  petProfile,
  petShortTextMaxLength,
  type Pet,
} from "@family-hub/contract";

import type { PetsApi } from "../pets.api.ts";
import type { PetsModel } from "../pets.model.ts";
import { fill } from "./form-fill.vm.ts";

type ProfileFormDependencies = {
  api: PetsApi;
  pets: Pick<PetsModel, "keep">;
  today: () => string;
  onSaved: (pet: Pet) => void;
};

const emptyProfile = {
  name: "",
  species: "dog",
  breed: "",
  sex: "",
  birthDate: "",
  chipNumber: "",
  notes: "",
};

type ProfileValues = typeof emptyProfile;

function valuesOf(pet: Pet): ProfileValues {
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? "",
    sex: pet.sex ?? "",
    birthDate: pet.birthDate ?? "",
    chipNumber: pet.chipNumber ?? "",
    notes: pet.notes ?? "",
  };
}

function tooLong(maxLength: number) {
  return z.string().max(maxLength, `Не длиннее ${maxLength} символов`);
}

function schemaFor(today: () => string) {
  return z.object({
    name: z.string().trim().min(1, "Введите имя").max(petNameMaxLength, "Слишком длинное имя"),
    species: z.string(),
    breed: tooLong(petShortTextMaxLength),
    sex: z.string(),
    birthDate: z
      .string()
      .refine((date) => date === "" || date <= today(), "Дата рождения ещё не наступила"),
    chipNumber: tooLong(petShortTextMaxLength),
    notes: tooLong(petLongTextMaxLength),
  });
}

async function saveProfile(
  { api, pets, onSaved }: Omit<ProfileFormDependencies, "today">,
  petId: string | undefined,
  values: ProfileValues,
): Promise<void> {
  const profile = petProfile.parse({
    ...values,
    sex: values.sex === "" ? null : values.sex,
    birthDate: values.birthDate === "" ? null : values.birthDate,
  });
  const saved = await wrap(
    petId === undefined ? api.create(profile) : api.saveProfile(petId, profile),
  );

  pets.keep(saved);
  onSaved(saved);
}

export function reatomPetProfileForm({ api, pets, today, onSaved }: ProfileFormDependencies) {
  const editedPetId = atom<string | undefined>(undefined, "pets.profileForm.editedPetId");
  const form = reatomForm(emptyProfile, {
    name: "pets.profileForm",
    schema: schemaFor(today),
    onSubmit: async (values: ProfileValues) => {
      await wrap(saveProfile({ api, pets, onSaved }, editedPetId(), values));
    },
  });

  return {
    form,
    isCreating: computed(() => editedPetId() === undefined, "pets.profileForm.isCreating"),
    isSaving: computed(() => !form.submit.ready(), "pets.profileForm.isSaving"),
    failure: computed((): string | undefined => {
      const isRejectedByServer =
        form.submit.error() !== undefined && form.validation().errors.length === 0;

      return isRejectedByServer ? "Не получилось сохранить. Попробуйте ещё раз." : undefined;
    }, "pets.profileForm.failure"),

    startCreating: action(() => {
      editedPetId.set(undefined);
      fill(form, emptyProfile);
    }, "pets.profileForm.startCreating"),
    save: action(() => {
      form.submit().catch(noop);
    }, "pets.profileForm.save"),
    startEditing: action((pet: Pet) => {
      editedPetId.set(pet.id);
      fill(form, valuesOf(pet));
    }, "pets.profileForm.startEditing"),
  };
}

export type PetProfileFormModel = ReturnType<typeof reatomPetProfileForm>;
