import { action, atom, computed, withAsync, withAsyncData, wrap } from "@reatom/core";

import type { Invite, InviteCreated } from "@family-hub/contract";

import { formatDayTime, type Viewer } from "@/common/format-date.lib.ts";
import { withoutId } from "@/common/records.lib.ts";
import { detached, reatomFailure } from "@/modules/changes";
import type { Haptics } from "@/modules/telegram";

import type { InvitesApi } from "../invites.api.ts";

export type InviteItem = { id: string; title: string };

type InvitesDependencies = {
  api: InvitesApi;
  telegram: {
    canShareMessage: boolean;
    shareMessage: (preparedMessageId: string) => Promise<boolean>;
    openTelegramLink: (url: string) => void;
    haptics: Pick<Haptics, "error" | "warning">;
  };
  viewer: () => Viewer;
};

const shareText = "Присоединяйтесь к нашей семье в Family Hub";

function shareUrl(link: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
}

function newestFirst(invites: Invite[]): Invite[] {
  return invites.toSorted((left, right) => right.expiresAt - left.expiresAt);
}

// The time keeps two Invites made on one day apart, «Отозвать» included.
function toItem(invite: Invite, viewer: Viewer): InviteItem {
  return { id: invite.id, title: `Приглашение до ${formatDayTime(invite.expiresAt, viewer)}` };
}

function reatomList(api: InvitesApi) {
  return computed(async () => wrap(api.list()), "invites.list").extend(withAsyncData());
}

type Sources = InvitesDependencies & {
  list: ReturnType<typeof reatomList>;
};

function reatomCreate({ api, telegram, list }: Sources) {
  async function share({ link, preparedMessageId }: InviteCreated): Promise<void> {
    if (preparedMessageId !== null && telegram.canShareMessage) {
      await wrap(telegram.shareMessage(preparedMessageId));
    } else {
      telegram.openTelegramLink(shareUrl(link));
    }
  }

  return action(async () => {
    const created = await wrap(api.create());
    const { preparedMessageId: _prepared, ...invite } = created;

    list.data.set(newestFirst([invite, ...(list.data() ?? [])]));
    await wrap(share(created));
  }, "invites.create").extend(withAsync());
}

function reatomRevoke({ api, list }: Sources) {
  return action(async (inviteId: string) => {
    const revoked = list.data()?.find((invite) => invite.id === inviteId);

    list.data.set(withoutId(list.data() ?? [], inviteId));

    try {
      await wrap(api.revoke(inviteId));
    } catch (error) {
      if (revoked) {
        list.data.set(newestFirst([...(list.data() ?? []), revoked]));
      }

      throw error;
    }
  }, "invites.revoke").extend(withAsync());
}

export function reatomInvites(dependencies: InvitesDependencies) {
  const list = reatomList(dependencies.api);
  const create = reatomCreate({ ...dependencies, list });
  const revoke = reatomRevoke({ ...dependencies, list });
  const createFailure = reatomFailure(create, {
    message: "Не получилось создать приглашение. Попробуйте ещё раз.",
    name: "invites.createFailure",
    haptics: dependencies.telegram.haptics,
  });
  const revokeFailure = reatomFailure(revoke, {
    message: "Не получилось отозвать приглашение. Попробуйте ещё раз.",
    name: "invites.revokeFailure",
    haptics: dependencies.telegram.haptics,
  });

  return {
    invites: computed(
      () => (list.data() ?? []).map((invite) => toItem(invite, dependencies.viewer())),
      "invites.items",
    ),
    isLoading: computed(
      () => list.data() === undefined && list.error() === undefined,
      "invites.isLoading",
    ),
    isInviting: computed(() => !create.ready(), "invites.isInviting"),
    isRevoking: computed(() => !revoke.ready(), "invites.isRevoking"),
    failure: computed(() => createFailure() ?? revokeFailure(), "invites.failure"),

    invite: detached(create, "invites.invite"),
    ...reatomRevokeConfirmation(dependencies, detached(revoke, "invites.revokeOne")),
  };
}

// The sent link stops working for good, so «Отозвать» asks first.
function reatomRevokeConfirmation(
  { telegram }: InvitesDependencies,
  revoke: (inviteId: string) => void,
) {
  const confirming = atom<string | undefined>(undefined, "invites.confirmingRevoke");
  const isConfirmingRevoke = computed(
    () => confirming() !== undefined,
    "invites.isConfirmingRevoke",
  );
  const cancelRevoke = action(() => {
    confirming.set(undefined);
  }, "invites.cancelRevoke");

  return {
    isConfirmingRevoke,
    // Telegram Back on the Profile closes the drawer first, so leaving it leaves no stale question.
    canGoBack: isConfirmingRevoke,
    isFormOpen: isConfirmingRevoke,
    back: cancelRevoke,
    revoke: action((inviteId: string) => {
      telegram.haptics.warning();
      confirming.set(inviteId);
    }, "invites.askRevoke"),
    cancelRevoke,
    confirmRevoke: action(() => {
      const inviteId = confirming();

      confirming.set(undefined);

      if (inviteId !== undefined) {
        revoke(inviteId);
      }
    }, "invites.confirmRevoke"),
  };
}

export type InvitesModel = ReturnType<typeof reatomInvites>;
