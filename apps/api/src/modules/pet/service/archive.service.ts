import type { Membership } from "@/common/auth";

import { isSamePetName } from "../pet.lib.ts";
import type { PetDependencies, PetRefusal, PetResult } from "../pet.types.ts";
import { asResult } from "./profile.service.ts";

// An archived Pet stops nudging; bringing it back resumes the dates still ahead.
export async function setArchived(
  dependencies: PetDependencies,
  { family }: Membership,
  { petId, isArchived }: { petId: string; isArchived: boolean },
): Promise<PetResult> {
  const { pets, clock, schedule } = dependencies;
  const now = clock.now();
  const saved = await pets.setArchivedAt({
    familyId: family.id,
    petId,
    archivedAt: isArchived ? now : null,
    now,
  });

  await schedule.petChanged(family.id, petId);

  return asResult(dependencies, saved);
}

export type DeleteResult = { status: "deleted" } | { status: PetRefusal };

export async function deletePet(
  { pets, schedule }: PetDependencies,
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
  await schedule.petChanged(family.id, petId);

  return { status: "deleted" };
}
