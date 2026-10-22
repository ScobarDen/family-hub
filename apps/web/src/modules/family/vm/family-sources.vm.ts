import { type Atom, computed, withAsyncData, wrap } from "@reatom/core";

import type { Dialogs } from "@/common/telegram";

import type { FamilyApi } from "../family.api.ts";

export type FamilyDependencies = {
  api: FamilyApi;
  telegram: Dialogs;
  self: () => { memberId: string; familyName: string } | undefined;
  onLeft: () => void;
};

export function reatomList(api: FamilyApi) {
  return computed(async () => wrap(api.members()), "family.list").extend(withAsyncData());
}

export type FamilySources = FamilyDependencies & {
  list: ReturnType<typeof reatomList>;
  failure: Atom<string | undefined>;
  isOwner: () => boolean;
};
