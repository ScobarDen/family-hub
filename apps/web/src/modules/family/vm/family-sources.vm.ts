import { type Atom, computed, withAsyncData, wrap } from "@reatom/core";

import type { Dialogs } from "@/common/telegram";

import type { FamilyApi } from "../family.api.ts";

export type FamilyDependencies = {
  api: FamilyApi;
  members: FamilyMembers;
  telegram: Dialogs;
  self: () => { memberId: string; familyName: string } | undefined;
  onLeft: () => void;
};

// The Family's Members, one query shared by every module that names them.
export function reatomFamilyMembers(api: FamilyApi) {
  return computed(async () => wrap(api.members()), "family.members").extend(withAsyncData());
}

export type FamilyMembers = ReturnType<typeof reatomFamilyMembers>;

export type FamilySources = FamilyDependencies & {
  list: FamilyMembers;
  failure: Atom<string | undefined>;
  isOwner: () => boolean;
};
