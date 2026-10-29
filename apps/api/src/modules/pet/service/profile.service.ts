import { uuidv7, type Pet, type PetMemoChange, type PetProfile } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import { toPet } from "../pet.lib.ts";
import type { PetRow } from "../pet.repo.ts";
import type { PetDependencies, PetResult } from "../pet.types.ts";

type Change<Values> = { petId: string; values: Values };

export async function petOf({ links }: PetDependencies, row: PetRow): Promise<Pet> {
  return toPet(row, row.avatarPhotoId === null ? null : await links.urlsOf(row.avatarPhotoId));
}

export async function list(dependencies: PetDependencies, { family }: Membership): Promise<Pet[]> {
  const rows = await dependencies.pets.list(family.id);

  return Promise.all(rows.map(async (row) => petOf(dependencies, row)));
}

export async function create(
  dependencies: PetDependencies,
  { family, member }: Membership,
  profile: PetProfile,
): Promise<Pet> {
  const { pets, clock, schedule } = dependencies;
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

  await schedule.sourceChanged(family.id, { kind: "pet", id });

  if (!created) {
    throw new Error("The Pet just added is missing");
  }

  return petOf(dependencies, created);
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

export async function asResult(
  dependencies: PetDependencies,
  saved: PetRow | undefined,
): Promise<PetResult> {
  return saved ? { status: "ok", pet: await petOf(dependencies, saved) } : { status: "not-found" };
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

  const result = await asResult(
    dependencies,
    await dependencies.pets.saveProfile({
      familyId: membership.family.id,
      petId,
      values,
      memberId: membership.member.id,
      now: dependencies.clock.now(),
    }),
  );

  // A Pet's Reminders follow its birthday alone; its name is read when a message is sent.
  if (pet.birthDate !== values.birthDate) {
    await dependencies.schedule.sourceChanged(membership.family.id, { kind: "pet", id: petId });
  }

  return result;
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
    dependencies,
    await dependencies.pets.saveMemo({
      familyId: membership.family.id,
      petId,
      values,
      memberId: membership.member.id,
      now: dependencies.clock.now(),
    }),
  );
}

export async function setAvatar(
  dependencies: PetDependencies,
  membership: Membership,
  { petId, photoId }: { petId: string; photoId: string | null },
): Promise<PetResult> {
  const pet = await editable(dependencies, membership, petId);
  const target = { familyId: membership.family.id, petId };

  if ("status" in pet) {
    return pet;
  }

  if (photoId !== null && !(await dependencies.pets.canBeAvatar({ ...target, photoId }))) {
    return { status: "photo-not-found" };
  }

  return asResult(
    dependencies,
    await dependencies.pets.setAvatar({ ...target, photoId, now: dependencies.clock.now() }),
  );
}
