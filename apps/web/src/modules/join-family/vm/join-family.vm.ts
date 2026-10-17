import { action, atom, computed, noop, withAsync, withAsyncData, wrap } from "@reatom/core";

import { parseDeepLink, type InvitePreview } from "@family-hub/contract";

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
  };
  onJoined: () => void;
};

function inviteTokenOf(startParameter: string | undefined): string | undefined {
  const link = parseDeepLink(startParameter);

  return link?.kind === "inv" ? link.id : undefined;
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
  const token = inviteTokenOf(telegram.startParam);
  const isClosed = atom(token === undefined, "joinFamily.isClosed");
  const preview = action(
    async (inviteToken: string) => wrap(api.preview(telegram.initData, inviteToken)),
    "joinFamily.preview",
  ).extend(withAsyncData());
  const accept = reatomAccept({ api, telegram, onJoined, preview, isClosed });
  const screen = computed((): JoinFamilyScreen => {
    if (isClosed()) {
      return { kind: "none" };
    }

    return screenOf(preview.data(), preview.error() !== undefined && preview.ready());
  }, "joinFamily.screen");

  return {
    screen,
    isOpen: computed(() => screen().kind !== "none", "joinFamily.isOpen"),
    isJoining: computed(() => !accept.ready(), "joinFamily.isJoining"),
    failure: computed(
      () =>
        accept.error() === undefined ? undefined : "Не получилось вступить. Попробуйте ещё раз.",
      "joinFamily.failure",
    ),

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
