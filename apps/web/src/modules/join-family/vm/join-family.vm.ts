import { action, atom, computed, noop, withAsync, withAsyncData, wrap } from "@reatom/core";

import { inviteTokenPattern, parseDeepLink, type InvitePreview } from "@family-hub/contract";

import { reatomFailure } from "@/modules/changes";
import type { Haptics } from "@/modules/telegram";

import type { AcceptOutcome, JoinFamilyApi } from "../join-family.api.ts";

export type JoinFamilyScreen =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "invite"; inviterName: string; familyName: string }
  | { kind: "unavailable" }
  | { kind: "in-other-family" }
  | { kind: "failed" };

type JoinFamilyDependencies = {
  api: JoinFamilyApi;
  telegram: {
    initData: string;
    startParam: string | undefined;
    requestWriteAccess: () => Promise<boolean>;
    haptics: Pick<Haptics, "error">;
  };
  onJoined: () => void;
};

type InviteLink = { kind: "none" } | { kind: "broken" } | { kind: "token"; token: string };

function inviteLinkOf(startParameter: string | undefined): InviteLink {
  const link = parseDeepLink(startParameter);

  if (link?.kind !== "inv") {
    return { kind: "none" };
  }

  return inviteTokenPattern.test(link.id) ? { kind: "token", token: link.id } : { kind: "broken" };
}

function screenOf(preview: InvitePreview | undefined, hasFailed: boolean): JoinFamilyScreen {
  if (preview === undefined) {
    return { kind: hasFailed ? "failed" : "loading" };
  }

  if (preview.status === "in-this-family") {
    return { kind: "none" };
  }

  if (preview.status === "open") {
    return { kind: "invite", inviterName: preview.inviterName, familyName: preview.familyName };
  }

  return { kind: preview.status };
}

type AcceptSources = JoinFamilyDependencies & {
  preview: { data: { set: (preview: InvitePreview) => void } };
  isClosed: { set: (isClosed: boolean) => void };
};

function reatomAccept({ api, telegram, onJoined, preview, isClosed }: AcceptSources) {
  return action(async (inviteToken: string): Promise<AcceptOutcome> => {
    // The bot can deliver Reminders to the new Member only with write access.
    await wrap(telegram.requestWriteAccess());

    const outcome = await wrap(api.accept(telegram.initData, inviteToken));

    if (outcome === "unavailable") {
      preview.data.set({ status: "unavailable" });
    } else {
      isClosed.set(true);
      onJoined();
    }

    return outcome;
  }, "joinFamily.accept").extend(withAsync());
}

export function reatomJoinFamily({ api, telegram, onJoined }: JoinFamilyDependencies) {
  const link = inviteLinkOf(telegram.startParam);
  const token = link.kind === "token" ? link.token : undefined;
  const isClosed = atom(link.kind === "none", "joinFamily.isClosed");
  const preview = action(
    async (inviteToken: string) => wrap(api.preview(telegram.initData, inviteToken)),
    "joinFamily.preview",
  ).extend(withAsyncData());
  const accept = reatomAccept({ api, telegram, onJoined, preview, isClosed });
  const screen = computed((): JoinFamilyScreen => {
    if (isClosed() || link.kind === "broken") {
      return { kind: isClosed() ? "none" : "unavailable" };
    }

    return screenOf(preview.data(), preview.error() !== undefined && preview.ready());
  }, "joinFamily.screen");

  return {
    screen,
    isOpen: computed(() => screen().kind !== "none", "joinFamily.isOpen"),
    isJoining: computed(() => !accept.ready(), "joinFamily.isJoining"),
    failure: reatomFailure(accept, {
      message: "Не получилось вступить. Попробуйте ещё раз.",
      name: "joinFamily.failure",
      haptics: telegram.haptics,
    }),

    load: action(() => {
      if (token !== undefined) {
        // A failure stays in preview.error() and shows the «failed» screen.
        preview(token).catch(noop);
      }
    }, "joinFamily.load"),
    join: action(() => {
      if (token !== undefined) {
        accept(token).catch(noop);
      }
    }, "joinFamily.join"),
    close: action(() => {
      isClosed.set(true);
    }, "joinFamily.close"),
  };
}

export type JoinFamilyModel = ReturnType<typeof reatomJoinFamily>;
