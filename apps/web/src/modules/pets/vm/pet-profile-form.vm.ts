import { action, reatomForm } from "@reatom/core";
import { z } from "zod";

import {
  petLongTextMaxLength,
  petNameMaxLength,
  petProfile,
  petShortTextMaxLength,
  type Pet,
  type PetProfile,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";
import type { Haptics } from "@/common/telegram";

import type { PetsApi } from "../pets.api.ts";
import type { PetsModel } from "../pets.model.ts";

type ProfileFormDependencies = {
  api: PetsApi;
  pets: Pick<PetsModel, "keep">;
  today: () => string;
  haptics: Pick<Haptics, "success" | "error">;
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

function profileOf(values: ProfileValues): PetProfile {
  return petProfile.parse({
    ...values,
    sex: values.sex === "" ? null : values.sex,
    birthDate: values.birthDate === "" ? null : values.birthDate,
  });
}

export function reatomPetProfileForm({
  api,
  pets,
  today,
  haptics,
  onSaved,
}: ProfileFormDependencies) {
  const record = reatomEditableRecord({
    name: "pets.profileRecord",
    form: (onSubmit) =>
      reatomForm(emptyProfile, { name: "pets.profileForm", schema: schemaFor(today), onSubmit }),
    failureMessage: "Не получилось сохранить. Попробуйте ещё раз.",
    haptics,
    valuesOf,
    create: async (values) => api.create(profileOf(values)),
    update: async (pet: Pet, values) => api.saveProfile(pet.id, profileOf(values)),
    onSaved: (saved) => {
      pets.keep(saved);
      onSaved(saved);
    },
  });

  return {
    ...record,
    startCreating: action(() => {
      record.startCreating(emptyProfile);
    }, "pets.profileForm.startCreating"),
  };
}

export type PetProfileFormModel = ReturnType<typeof reatomPetProfileForm>;
