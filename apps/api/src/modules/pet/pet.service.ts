import { uuidv7, type Pet, type PetMemoChange, type PetProfile } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import type { PetRepo, PetRow } from "./pet.repo.ts";

type PetServiceDependencies = { pets: PetRepo; clock: Clock };

function toPet(row: PetRow): Pet {
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

async function list({ pets }: PetServiceDependencies, { family }: Membership): Promise<Pet[]> {
  const rows = await pets.list(family.id);

  return rows.map(toPet);
}

async function create(
  { pets, clock }: PetServiceDependencies,
  { family, member }: Membership,
  profile: PetProfile,
): Promise<Pet> {
  const now = clock.now();
  const id = uuidv7(now);

  await pets.add({
    id,
    familyId: family.id,
    ...profile,
    createdAt: now,
    createdBy: member.id,
    updatedAt: now,
  });

  const created = await pets.find(family.id, id);

  if (!created) {
    throw new Error("The Pet just added is missing");
  }

  return toPet(created);
}

type Change<Values> = { petId: string; values: Values };

async function saveProfile(
  { pets, clock }: PetServiceDependencies,
  { family, member }: Membership,
  { petId, values }: Change<PetProfile>,
): Promise<Pet | undefined> {
  const saved = await pets.saveProfile({
    familyId: family.id,
    petId,
    values,
    memberId: member.id,
    now: clock.now(),
  });

  return saved && toPet(saved);
}

async function saveMemo(
  { pets, clock }: PetServiceDependencies,
  { family, member }: Membership,
  { petId, values }: Change<PetMemoChange>,
): Promise<Pet | undefined> {
  const saved = await pets.saveMemo({
    familyId: family.id,
    petId,
    values,
    memberId: member.id,
    now: clock.now(),
  });

  return saved && toPet(saved);
}

export function createPetService(dependencies: PetServiceDependencies) {
  return {
    list: async (membership: Membership) => list(dependencies, membership),
    create: async (membership: Membership, profile: PetProfile) =>
      create(dependencies, membership, profile),
    saveProfile: async (membership: Membership, petId: string, values: PetProfile) =>
      saveProfile(dependencies, membership, { petId, values }),
    saveMemo: async (membership: Membership, petId: string, values: PetMemoChange) =>
      saveMemo(dependencies, membership, { petId, values }),
  };
}

export type PetService = ReturnType<typeof createPetService>;
