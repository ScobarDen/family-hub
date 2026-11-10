import type { Atom } from "@reatom/core";

import { reatomLiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";
import type { Dialogs, Haptics } from "@/modules/telegram";

import type { FamilyApi } from "../family.api.ts";

export type FamilyDependencies = {
  api: FamilyApi;
  members: FamilyMembers;
  telegram: Dialogs & { haptics: Haptics };
  self: () => { memberId: string; familyName: string } | undefined;
  onLeft: () => void;
};

// The Family's Members, one query shared by every module that names them.
export function reatomFamilyMembers({ api, liveVersion }: { api: FamilyApi } & LiveVersion) {
  return reatomLiveResource({
    name: "family.members",
    liveVersion,
    load: async () => api.members(),
  });
}

export type FamilyMembers = ReturnType<typeof reatomFamilyMembers>;

export type FamilySources = FamilyDependencies & {
  list: FamilyMembers;
  failure: Atom<string | undefined>;
  isOwner: () => boolean;
};
