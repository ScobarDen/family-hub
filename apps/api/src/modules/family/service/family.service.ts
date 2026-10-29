import { bindFirst } from "@/common/bind.lib.ts";

import type { FamilyDependencies } from "../family.types.ts";
import { leave, remove } from "./departure.service.ts";
import { deleteFamily, handOver } from "./ownership.service.ts";

export function createFamilyService(dependencies: FamilyDependencies) {
  return {
    ...bindFirst(dependencies, { leave, remove, handOver, delete: deleteFamily }),
  };
}

export type FamilyService = ReturnType<typeof createFamilyService>;
