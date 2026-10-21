import { z } from "zod";

export const petSpecies = z.enum(["dog", "cat", "bird", "rodent", "fish", "reptile", "other"]);

export type PetSpecies = z.infer<typeof petSpecies>;

export const petSex = z.enum(["male", "female"]);

export type PetSex = z.infer<typeof petSex>;

export const petNameMaxLength = 64;
export const petShortTextMaxLength = 100;
export const petLongTextMaxLength = 2000;

// The Mini App sends an emptied field as "", which means the field is cleared.
function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .transform((text) => (text === "" ? null : text));
}

export const petProfile = z.object({
  name: z.string().trim().min(1).max(petNameMaxLength),
  species: petSpecies,
  breed: optionalText(petShortTextMaxLength),
  sex: petSex.nullable(),
  birthDate: z.iso.date().nullable(),
  chipNumber: optionalText(petShortTextMaxLength),
  notes: optionalText(petLongTextMaxLength),
});

export type PetProfile = z.infer<typeof petProfile>;

export const petMemoChange = z.object({
  food: optionalText(petLongTextMaxLength),
  clinic: optionalText(petLongTextMaxLength),
  important: optionalText(petLongTextMaxLength),
});

export type PetMemoChange = z.infer<typeof petMemoChange>;

export const petMemo = petMemoChange.extend({
  updatedAt: z.number().nullable(),
  updatedBy: z.string().nullable(),
});

export type PetMemo = z.infer<typeof petMemo>;

export const pet = petProfile.extend({
  id: z.string(),
  archivedAt: z.number().nullable(),
  memo: petMemo,
});

export type Pet = z.infer<typeof pet>;

export const petList = z.array(pet);

export type PetList = z.infer<typeof petList>;
