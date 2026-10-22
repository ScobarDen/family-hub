import type { PetMemoChange, PetProfile } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { bindFirst } from "@/common/bind";

import type { PetDependencies } from "../pet.types.ts";
import { deletePet, setArchived } from "./archive.service.ts";
import { create, list, saveMemo, saveProfile, setAvatar } from "./profile.service.ts";

export function createPetService(dependencies: PetDependencies) {
  return {
    ...bindFirst(dependencies, { list, create }),
    saveProfile: async (membership: Membership, petId: string, values: PetProfile) =>
      saveProfile(dependencies, membership, { petId, values }),
    saveMemo: async (membership: Membership, petId: string, values: PetMemoChange) =>
      saveMemo(dependencies, membership, { petId, values }),
    archive: async (membership: Membership, petId: string) =>
      setArchived(dependencies, membership, { petId, isArchived: true }),
    unarchive: async (membership: Membership, petId: string) =>
      setArchived(dependencies, membership, { petId, isArchived: false }),
    setAvatar: async (membership: Membership, petId: string, photoId: string | null) =>
      setAvatar(dependencies, membership, { petId, photoId }),
    delete: async (membership: Membership, petId: string, petName: string) =>
      deletePet(dependencies, membership, { petId, petName }),
  };
}

export type PetService = ReturnType<typeof createPetService>;
