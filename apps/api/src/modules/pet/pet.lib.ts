import type { Pet } from "@family-hub/contract";

import type { PetRow } from "./pet.repo.ts";

export function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birthDate,
    chipNumber: row.chipNumber,
    notes: row.notes,
    archivedAt: row.archivedAt,
    memo: {
      food: row.memoFood,
      clinic: row.memoClinic,
      important: row.memoImportant,
      updatedAt: row.memoUpdatedAt,
      updatedBy: row.memoUpdatedByName,
    },
  };
}

// Deleting a Pet forever takes typing its name, as deleting the Family does.
export function isSamePetName(typed: string, petName: string): boolean {
  return typed.trim() === petName.trim();
}
