import { action, atom, computed, withAsync, withAsyncData, wrap } from "@reatom/core";

import type { Invite, InviteCreated } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";
import { detached, readOnly } from "@/common/state";

import type { InvitesApi } from "../invites.api.ts";

export type InviteItem = { id: string; expiresOn: string };

type InvitesDependencies = {
  api: InvitesApi;
  telegram: {
    canShareMessage: boolean;
    shareMessage: (preparedMessageId: string) => Promise<boolean>;
    openTelegramLink: (url: string) => void;
  };
  timeZone: () => string;
};

const shareText = "Присоединяйтесь к нашей семье в Family Hub";

function shareUrl(link: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
}

function newestFirst(invites: Invite[]): Invite[] {
  return invites.toSorted((left, right) => right.expiresAt - left.expiresAt);
}

function toItem(invite: Invite, timeZone: string): InviteItem {
  return { id: invite.id, expiresOn: `до ${formatDay(invite.expiresAt, timeZone)}` };
}

function reatomList(api: InvitesApi) {
  return computed(async () => wrap(api.list()), "invites.list").extend(withAsyncData());
}

type Sources = InvitesDependencies & {
  list: ReturnType<typeof reatomList>;
  failure: { set: (failure: string | undefined) => void };
};

function reatomCreate({ api, telegram, list, failure }: Sources) {
  async function share({ link, preparedMessageId }: InviteCreated): Promise<void> {
    if (preparedMessageId !== null && telegram.canShareMessage) {
      await wrap(telegram.shareMessage(preparedMessageId));
    } else {
      telegram.openTelegramLink(shareUrl(link));
    }
  }

  return action(async () => {
    failure.set(undefined);

    try {
      const created = await wrap(api.create());
      const { preparedMessageId: _prepared, ...invite } = created;

      list.data.set(newestFirst([invite, ...(list.data() ?? [])]));
      await wrap(share(created));
    } catch {
      failure.set("Не получилось создать приглашение. Попробуйте ещё раз.");
    }
  }, "invites.create").extend(withAsync());
}

function reatomRevoke({ api, list, failure }: Sources) {
  return action(async (inviteId: string) => {
    const revoked = list.data()?.find((invite) => invite.id === inviteId);

    failure.set(undefined);
    list.data.set(list.data()?.filter((invite) => invite.id !== inviteId));

    try {
      await wrap(api.revoke(inviteId));
    } catch {
      if (revoked) {
        list.data.set(newestFirst([...(list.data() ?? []), revoked]));
      }

      failure.set("Не получилось отозвать приглашение. Попробуйте ещё раз.");
    }
  }, "invites.revoke").extend(withAsync());
}

export function reatomInvites(dependencies: InvitesDependencies) {
  const list = reatomList(dependencies.api);
  const failure = atom<string | undefined>(undefined, "invites.failure");
  const create = reatomCreate({ ...dependencies, list, failure });
  const revoke = reatomRevoke({ ...dependencies, list, failure });

  return {
    invites: computed(
      () => (list.data() ?? []).map((invite) => toItem(invite, dependencies.timeZone())),
      "invites.items",
    ),
    isLoading: computed(
      () => list.data() === undefined && list.error() === undefined,
      "invites.isLoading",
    ),
    isInviting: computed(() => !create.ready(), "invites.isInviting"),
    isRevoking: computed(() => !revoke.ready(), "invites.isRevoking"),
    failure: readOnly(failure),

    invite: detached(create, "invites.invite"),
    revoke: detached(revoke, "invites.revokeOne"),
  };
}

export type InvitesModel = ReturnType<typeof reatomInvites>;
