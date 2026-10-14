import { action, computed, noop } from "@reatom/core";

import type { SessionApi } from "../session.api.ts";
import { reatomSignIn, type SignInOutcome } from "../session.model.ts";

export type SessionScreen =
  | { kind: "signing-in" }
  | { kind: "outside-telegram" }
  | { kind: "stranger" }
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

  return { kind: outcome.status };
}

export function reatomSession({ api, telegram }: SessionDependencies) {
  const signIn = reatomSignIn({ api, initData: telegram.initData });

  return {
    screen: computed((): SessionScreen => {
      if (api.isSessionLost()) {
        return { kind: "restart" };
      }

      return signIn.error() === undefined ? screenOf(signIn.data()) : { kind: "failed" };
    }, "session.screen"),

    signIn: action(() => {
      // A failure stays in signIn.error() and shows the «failed» screen.
      signIn().catch(noop);
    }, "session.start"),

    showInviteHelp: action(() => {
      telegram.showAlert("Откройте ссылку-приглашение, которую вам прислал кто-то из семьи.");
    }, "session.showInviteHelp"),

    requestFamily: action(() => {
      telegram.showAlert("Скоро здесь можно будет попросить создать свою семью.");
    }, "session.requestFamily"),
  };
}

export type SessionModel = ReturnType<typeof reatomSession>;
