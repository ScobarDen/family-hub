import type { PetMemoChange, PetProfile } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { PetDependencies } from "../pet.types.ts";
import { deletePet, setArchived } from "./archive.service.ts";
import { create, list, saveMemo, saveProfile } from "./profile.service.ts";

export function createPetService(dependencies: PetDependencies) {
  return {
    list: async (membership: Membership) => list(dependencies, membership),
    create: async (membership: Membership, profile: PetProfile) =>
      create(dependencies, membership, profile),
    saveProfile: async (membership: Membership, petId: string, values: PetProfile) =>
      saveProfile(dependencies, membership, { petId, values }),
    saveMemo: async (membership: Membership, petId: string, values: PetMemoChange) =>
      saveMemo(dependencies, membership, { petId, values }),
    archive: async (membership: Membership, petId: string) =>
      setArchived(dependencies, membership, { petId, isArchived: true }),
    unarchive: async (membership: Membership, petId: string) =>
      setArchived(dependencies, membership, { petId, isArchived: false }),
    delete: async (membership: Membership, petId: string, petName: string) =>
      deletePet(dependencies, membership, { petId, petName }),
  };
}

export type PetService = ReturnType<typeof createPetService>;
