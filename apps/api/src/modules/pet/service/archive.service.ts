import type { Membership } from "@/common/auth";

import { isSamePetName, toPet } from "../pet.lib.ts";
import type { PetDependencies, PetRefusal, PetResult } from "../pet.types.ts";

export async function setArchived(
  { pets, clock }: PetDependencies,
  { family }: Membership,
  { petId, isArchived }: { petId: string; isArchived: boolean },
): Promise<PetResult> {
  const now = clock.now();
  const saved = await pets.setArchivedAt({
    familyId: family.id,
    petId,
    archivedAt: isArchived ? now : null,
    now,
  });

  return saved ? { status: "ok", pet: toPet(saved) } : { status: "not-found" };
}

export type DeleteResult = { status: "deleted" } | { status: PetRefusal };

export async function deletePet(
  { pets }: PetDependencies,
  { family, isFamilyOwner }: Membership,
  { petId, petName }: { petId: string; petName: string },
): Promise<DeleteResult> {
  if (!isFamilyOwner) {
    return { status: "not-owner" };
  }

  const pet = await pets.find(family.id, petId);

  if (!pet) {
    return { status: "not-found" };
  }

  if (!isSamePetName(petName, pet.name)) {
    return { status: "name-mismatch" };
  }

  await pets.delete(family.id, petId);

  return { status: "deleted" };
}
