import { action, atom, computed, noop } from "@reatom/core";

import type { FamilyRequestStatus } from "@family-hub/contract";

import type { SessionApi } from "../session.api.ts";
import { reatomSignIn, type SignInOutcome } from "../session.model.ts";

export type SessionScreen =
  | { kind: "signing-in" }
  | { kind: "outside-telegram" }
  | { kind: "stranger" }
  | { kind: "family-request" }
  | { kind: "member"; memberName: string; familyName: string }
  | { kind: "restart" }
  | { kind: "failed" };

type SessionDependencies = {
  api: SessionApi;
  telegram: { initData: string; showAlert: (message: string) => void };
};

function screenOf(outcome: SignInOutcome | undefined): SessionScreen {
  if (outcome === undefined) {
    return { kind: "signing-in" };
  }

  if (outcome.status === "member") {
    const { member, family } = outcome.member;

    return { kind: "member", memberName: member.name, familyName: family.name };
  }

  if (outcome.status === "stranger") {
    return { kind: outcome.familyRequest === "pending" ? "family-request" : "stranger" };
  }

  return { kind: outcome.status };
}

export function reatomSession({ api, telegram }: SessionDependencies) {
  const signIn = reatomSignIn({ api, initData: telegram.initData });
  const isRequestingFamily = atom(false, "session.isRequestingFamily");
  const familyRequestStatus = computed((): FamilyRequestStatus | undefined => {
    const outcome = signIn.data();

    return outcome?.status === "stranger" ? outcome.familyRequest : undefined;
  }, "session.familyRequestStatus");

  return {
    familyRequestStatus,

    screen: computed((): SessionScreen => {
      if (api.isSessionLost()) {
        return { kind: "restart" };
      }

      if (signIn.error() !== undefined) {
        return { kind: "failed" };
      }

      const screen = screenOf(signIn.data());

      return screen.kind === "stranger" && isRequestingFamily()
        ? { kind: "family-request" }
        : screen;
    }, "session.screen"),

    signIn: action(() => {
      // A failure stays in signIn.error() and shows the «failed» screen.
      signIn().catch(noop);
    }, "session.start"),

    showInviteHelp: action(() => {
      telegram.showAlert("Откройте ссылку-приглашение, которую вам прислал кто-то из семьи.");
    }, "session.showInviteHelp"),

    requestFamily: action(() => {
      isRequestingFamily.set(true);
    }, "session.requestFamily"),

    closeFamilyRequest: action(() => {
      isRequestingFamily.set(false);
    }, "session.closeFamilyRequest"),
  };
}

export type SessionModel = ReturnType<typeof reatomSession>;
