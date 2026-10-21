import type { Membership } from "@/common/auth";

import type { FamilyDependencies } from "../family.types.ts";
import { leave, remove } from "./departure.service.ts";
import { deleteFamily, handOver } from "./ownership.service.ts";

export function createFamilyService(dependencies: FamilyDependencies) {
  return {
    leave: async (membership: Membership) => leave(dependencies, membership),
    remove: async (membership: Membership, memberId: string) =>
      remove(dependencies, membership, memberId),
    handOver: async (membership: Membership, memberId: string) =>
      handOver(dependencies, membership, memberId),
    delete: async (membership: Membership, familyName: string) =>
      deleteFamily(dependencies, membership, familyName),
  };
}

export type FamilyService = ReturnType<typeof createFamilyService>;
