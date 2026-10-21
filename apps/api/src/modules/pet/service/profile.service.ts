import { uuidv7, type Pet, type PetMemoChange, type PetProfile } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import { toPet } from "../pet.lib.ts";
import type { PetRow } from "../pet.repo.ts";
import type { PetDependencies, PetResult } from "../pet.types.ts";

type Change<Values> = { petId: string; values: Values };

export async function list({ pets }: PetDependencies, { family }: Membership): Promise<Pet[]> {
  const rows = await pets.list(family.id);

  return rows.map(toPet);
}

export async function create(
  { pets, clock }: PetDependencies,
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

// An archived Pet is kept for its history and reads only.
async function editable(
  { pets }: PetDependencies,
  { family }: Membership,
  petId: string,
): Promise<PetRow | PetResult> {
  const row = await pets.find(family.id, petId);

  if (!row) {
    return { status: "not-found" };
  }

  return row.archivedAt === null ? row : { status: "archived" };
}

function asResult(saved: PetRow | undefined): PetResult {
  return saved ? { status: "ok", pet: toPet(saved) } : { status: "not-found" };
}

export async function saveProfile(
  dependencies: PetDependencies,
  membership: Membership,
  { petId, values }: Change<PetProfile>,
): Promise<PetResult> {
  const pet = await editable(dependencies, membership, petId);

  if ("status" in pet) {
    return pet;
  }

  return asResult(
    await dependencies.pets.saveProfile({
      familyId: membership.family.id,
      petId,
      values,
      memberId: membership.member.id,
      now: dependencies.clock.now(),
    }),
  );
}

export async function saveMemo(
  dependencies: PetDependencies,
  membership: Membership,
  { petId, values }: Change<PetMemoChange>,
): Promise<PetResult> {
  const pet = await editable(dependencies, membership, petId);

  if ("status" in pet) {
    return pet;
  }

  return asResult(
    await dependencies.pets.saveMemo({
      familyId: membership.family.id,
      petId,
      values,
      memberId: membership.member.id,
      now: dependencies.clock.now(),
    }),
  );
}
