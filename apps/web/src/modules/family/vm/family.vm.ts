import { action, atom, computed, reatomBoolean, retryComputed } from "@reatom/core";

import { fillForm, reatomSubmitFailure } from "@/common/form";
import { detached, readOnly } from "@/common/state";

import { reatomDeletion, reatomLeave } from "./family-exit.vm.ts";
import { reatomManage } from "./family-manage.vm.ts";
import type { FamilyDependencies, FamilySources } from "./family-sources.vm.ts";

export type FamilyMemberItem = {
  id: string;
  name: string;
  profilePicture: string | null;
  isFamilyOwner: boolean;
  role: string | undefined;
  isManageable: boolean;
};

function reatomSources(dependencies: FamilyDependencies): FamilySources {
  const list = dependencies.members;

  return {
    ...dependencies,
    list,
    failure: atom<string | undefined>(undefined, "family.failure"),
    isOwner: computed(
      () =>
        list.data()?.find(({ id }) => id === dependencies.self()?.memberId)?.isFamilyOwner ?? false,
      "family.isOwner",
    ),
  };
}

function reatomMembers({ list, isOwner, self }: FamilySources) {
  return computed(
    (): FamilyMemberItem[] =>
      (list.data() ?? []).map(({ id, name, profilePicture, isFamilyOwner }) => ({
        id,
        name,
        profilePicture,
        isFamilyOwner,
        role: isFamilyOwner ? "Владелец" : undefined,
        isManageable: isOwner() && id !== self()?.memberId,
      })),
    "family.members",
  );
}

function reatomDeletionFlow(sources: FamilySources) {
  const isOpen = reatomBoolean(false, "family.isDeletionOpen");
  const form = reatomDeletion(sources);

  return {
    deletion: form,
    isDeletionOpen: readOnly(isOpen),
    isDeleting: computed(() => !form.submit.ready(), "family.isDeleting"),
    deletionFailure: reatomSubmitFailure(form, {
      message: "Не получилось удалить семью. Попробуйте ещё раз.",
      name: "family.deletionFailure",
      haptics: sources.telegram.haptics,
    }),

    openDeletion: action(() => {
      isOpen.setTrue();
    }, "family.openDeletion"),
    closeDeletion: action(() => {
      isOpen.setFalse();

      fillForm(form, { familyName: "" });
    }, "family.closeDeletion"),
    deleteFamily: detached(form.submit, "family.deleteFamily"),
  };
}

export function reatomFamily(dependencies: FamilyDependencies) {
  const sources = reatomSources(dependencies);
  const deletionFlow = reatomDeletionFlow(sources);
  const manage = reatomManage(sources);
  const leave = reatomLeave(sources, deletionFlow.openDeletion);

  return {
    members: reatomMembers(sources),
    loadFailure: computed(
      () =>
        sources.list.error() === undefined ? undefined : "Не получилось загрузить участников.",
      "family.loadFailure",
    ),
    failure: readOnly(sources.failure),
    canDeleteFamily: readOnly(sources.isOwner),
    isBusy: computed(() => !manage.ready() || !leave.ready(), "family.isBusy"),
    ...deletionFlow,

    retry: detached(async () => retryComputed(sources.list), "family.retry"),
    manage: detached(manage, "family.manageOne"),
    leave: detached(leave, "family.leaveFamily"),
  };
}

export type FamilyModel = ReturnType<typeof reatomFamily>;
