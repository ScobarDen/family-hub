import { computed, withAsyncData, wrap } from "@reatom/core";

import type { FamilyApi } from "../family.api.ts";

export type FamilyMemberItem = {
  id: string;
  name: string;
  isFamilyOwner: boolean;
  role: string | undefined;
};

export function reatomFamily({ api }: { api: FamilyApi }) {
  const list = computed(async () => wrap(api.members()), "family.list").extend(withAsyncData());

  return {
    members: computed(
      (): FamilyMemberItem[] =>
        (list.data() ?? []).map(({ id, name, isFamilyOwner }) => ({
          id,
          name,
          isFamilyOwner,
          role: isFamilyOwner ? "Владелец" : undefined,
        })),
      "family.members",
    ),
    failure: computed(
      () => (list.error() === undefined ? undefined : "Не получилось загрузить участников."),
      "family.failure",
    ),
  };
}

export type FamilyModel = ReturnType<typeof reatomFamily>;
