import { action, atom, computed, noop } from "@reatom/core";

import { reatomDeletion, reatomLeave } from "./family-exit.vm.ts";
import { reatomManage } from "./family-manage.vm.ts";
import { reatomList, type FamilyDependencies, type FamilySources } from "./family-sources.vm.ts";

export type FamilyMemberItem = {
  id: string;
  name: string;
  isFamilyOwner: boolean;
  role: string | undefined;
  isManageable: boolean;
};

function reatomSources(dependencies: FamilyDependencies): FamilySources {
  const list = reatomList(dependencies.api);

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
      (list.data() ?? []).map(({ id, name, isFamilyOwner }) => ({
        id,
        name,
        isFamilyOwner,
        role: isFamilyOwner ? "Владелец" : undefined,
        isManageable: isOwner() && id !== self()?.memberId,
      })),
    "family.members",
  );
}

function reatomDeletionFlow(sources: FamilySources) {
  const isOpen = atom(false, "family.isDeletionOpen");
  const form = reatomDeletion(sources);

  return {
    deletion: form,
    isDeletionOpen: computed(() => isOpen(), "family.isDeletionOpenNow"),
    isDeleting: computed(() => !form.submit.ready(), "family.isDeleting"),
    deletionFailure: computed((): string | undefined => {
      const isRejectedByServer =
        form.submit.error() !== undefined && form.validation().errors.length === 0;

      return isRejectedByServer ? "Не получилось удалить семью. Попробуйте ещё раз." : undefined;
    }, "family.deletionFailure"),

    openDeletion: action(() => {
      isOpen.set(true);
    }, "family.openDeletion"),
    closeDeletion: action(() => {
      isOpen.set(false);

      // The form's own reset would also abort the next submit, so the fields are reset one by one.
      for (const field of form.fieldsList()) {
        field.reset();
      }
    }, "family.closeDeletion"),
    deleteFamily: action(() => {
      form.submit().catch(noop);
    }, "family.deleteFamily"),
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
    failure: computed(() => sources.failure(), "family.visibleFailure"),
    canDeleteFamily: computed(() => sources.isOwner(), "family.canDeleteFamily"),
    isBusy: computed(() => !manage.ready() || !leave.ready(), "family.isBusy"),
    ...deletionFlow,

    manage: action((memberId: string) => {
      manage(memberId).catch(noop);
    }, "family.manageOne"),
    leave: action(() => {
      leave().catch(noop);
    }, "family.leaveFamily"),
  };
}

export type FamilyModel = ReturnType<typeof reatomFamily>;
