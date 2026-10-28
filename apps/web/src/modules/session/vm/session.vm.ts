import { action, computed, noop, reatomBoolean } from "@reatom/core";

import type { CurrentMember, FamilyRequestStatus } from "@family-hub/contract";

import type { SessionApi } from "../session.api.ts";
import {
  reatomShell,
  reatomSignIn,
  type SessionCache,
  type SignInOutcome,
} from "../session.model.ts";

export type SessionScreen =
  | { kind: "signing-in" }
  | { kind: "outside-telegram" }
  | { kind: "stranger" }
  | { kind: "family-request" }
  | { kind: "join-family" }
  | { kind: "member"; memberName: string; familyName: string }
  | { kind: "restart" }
  | { kind: "failed" };

type SessionDependencies = {
  api: SessionApi;
  telegram: {
    initData: string;
    startParam: string | undefined;
    showAlert: (message: string) => void;
  };
  isJoiningFamily: () => boolean;
  deviceCache: SessionCache;
};

function memberScreenOf({ member, family }: CurrentMember): SessionScreen {
  return { kind: "member", memberName: member.name, familyName: family.name };
}

function screenOf(outcome: SignInOutcome): SessionScreen {
  if (outcome.status === "member") {
    return memberScreenOf(outcome.member);
  }

  if (outcome.status === "stranger") {
    return { kind: outcome.familyRequest === "pending" ? "family-request" : "stranger" };
  }

  return { kind: outcome.status };
}

type ScreenSources = Pick<SessionDependencies, "api" | "isJoiningFamily"> & {
  signIn: ReturnType<typeof reatomSignIn>;
  shell: () => CurrentMember | undefined;
  isRequestingFamily: () => boolean;
};

function currentScreen({
  api,
  signIn,
  shell,
  isJoiningFamily,
  isRequestingFamily,
}: ScreenSources): SessionScreen {
  if (api.isSessionLost()) {
    return { kind: "restart" };
  }

  if (isJoiningFamily()) {
    return { kind: "join-family" };
  }

  return signIn.error() === undefined
    ? answeredScreen({ signIn, shell, isRequestingFamily })
    : { kind: "failed" };
}

function answeredScreen({
  signIn,
  shell,
  isRequestingFamily,
}: Pick<ScreenSources, "signIn" | "shell" | "isRequestingFamily">): SessionScreen {
  const outcome = signIn.data();

  if (outcome === undefined) {
    const cached = shell();

    return cached === undefined ? { kind: "signing-in" } : memberScreenOf(cached);
  }

  // A repeated sign-in after joining a Family must not flash the stranger screen.
  if (!signIn.ready()) {
    return { kind: "signing-in" };
  }

  const screen = screenOf(outcome);

  return screen.kind === "stranger" && isRequestingFamily() ? { kind: "family-request" } : screen;
}

// Until sign-in answers, the shell's Member.
function reatomMember({ signIn, shell }: Pick<ScreenSources, "signIn" | "shell">) {
  return computed((): CurrentMember | undefined => {
    const outcome = signIn.data();

    if (outcome === undefined) {
      return shell();
    }

    return outcome.status === "member" ? outcome.member : undefined;
  }, "session.member");
}

export function reatomSession({
  api,
  telegram,
  isJoiningFamily,
  deviceCache,
}: SessionDependencies) {
  const { cachedMember, shell } = reatomShell({ deviceCache, startParam: telegram.startParam });
  const signIn = reatomSignIn({ api, initData: telegram.initData, deviceCache, cachedMember });
  const isRequestingFamily = reatomBoolean(false, "session.isRequestingFamily");
  const familyRequestStatus = computed((): FamilyRequestStatus | undefined => {
    const outcome = signIn.data();

    return outcome?.status === "stranger" ? outcome.familyRequest : undefined;
  }, "session.familyRequestStatus");
  const member = reatomMember({ signIn, shell });

  return {
    familyRequestStatus,
    member,
    isSignedIn: computed(() => signIn.data()?.status === "member", "session.isSignedIn"),
    memberName: computed(() => member()?.member.name ?? "", "session.memberName"),
    familyName: computed(() => member()?.family.name ?? "", "session.familyName"),

    screen: computed(
      () => currentScreen({ api, signIn, shell, isJoiningFamily, isRequestingFamily }),
      "session.screen",
    ),

    signIn: action(() => {
      // A failure stays in signIn.error() and shows the «failed» screen.
      signIn().catch(noop);
    }, "session.start"),

    showInviteHelp: action(() => {
      telegram.showAlert("Откройте ссылку-приглашение, которую вам прислал кто-то из семьи.");
    }, "session.showInviteHelp"),

    requestFamily: action(() => {
      isRequestingFamily.setTrue();
    }, "session.requestFamily"),

    closeFamilyRequest: action(() => {
      isRequestingFamily.setFalse();
    }, "session.closeFamilyRequest"),
  };
}

export type SessionModel = ReturnType<typeof reatomSession>;
