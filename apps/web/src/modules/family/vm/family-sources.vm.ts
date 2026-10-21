import { computed, withAsyncData, wrap, type Atom } from "@reatom/core";

import type { PopupParams } from "@/common/telegram";

import type { FamilyApi } from "../family.api.ts";

export type FamilyDependencies = {
  api: FamilyApi;
  telegram: {
    showAlert: (message: string) => void;
    showPopup: (params: PopupParams) => Promise<string | undefined>;
  };
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

type Confirmation = { title: string; message: string; button: string };

const confirmed = "confirm";

export async function isConfirmed(
  telegram: FamilyDependencies["telegram"],
  { title, message, button }: Confirmation,
): Promise<boolean> {
  const choice = await wrap(
    telegram.showPopup({
      title,
      message,
      buttons: [
        { id: confirmed, type: "destructive", text: button },
        { id: "cancel", type: "cancel" },
      ],
    }),
  );

  return choice === confirmed;
}
