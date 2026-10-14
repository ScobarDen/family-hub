import { action, atom, computed, wrap } from "@reatom/core";

import type { Telegram } from "@/common/telegram";

import type { SessionApi } from "../session.api.ts";

export type SessionScreen =
  | { kind: "signing-in" }
  | { kind: "outside-telegram" }
  | { kind: "stranger" }
  | { kind: "member"; memberName: string; familyName: string }
  | { kind: "restart" }
  | { kind: "failed" };

type SessionDependencies = {
  api: SessionApi;
  telegram: Pick<Telegram, "initData" | "showAlert">;
};

const restart: SessionScreen = { kind: "restart" };
const failed: SessionScreen = { kind: "failed" };

async function screenAfterSignIn(api: SessionApi, initData: string): Promise<SessionScreen> {
  const session = await wrap(api.signIn(initData));

  if (session.status === "stranger") {
    return { kind: "stranger" };
  }

  const { member, family } = await wrap(api.currentMember());

  return { kind: "member", memberName: member.name, familyName: family.name };
}

export function reatomSession({ api, telegram }: SessionDependencies) {
  const state = atom<SessionScreen>({ kind: "signing-in" }, "session.state");

  const signIn = action(async () => {
    if (telegram.initData === "") {
      state.set({ kind: "outside-telegram" });

      return;
    }

    state.set({ kind: "signing-in" });

    try {
      state.set(await wrap(screenAfterSignIn(api, telegram.initData)));
    } catch {
      state.set(failed);
    }
  }, "session.signIn");

  return {
    screen: computed(() => (api.isSessionLost() ? restart : state()), "session.screen"),

    signIn,

    retry: action(() => {
      signIn().catch(() => state.set(failed));
    }, "session.retry"),

    showInviteHelp: action(() => {
      telegram.showAlert("Откройте ссылку-приглашение, которую вам прислал кто-то из семьи.");
    }, "session.showInviteHelp"),

    requestFamily: action(() => {
      telegram.showAlert("Скоро здесь можно будет попросить создать свою семью.");
    }, "session.requestFamily"),
  };
}

export type SessionModel = ReturnType<typeof reatomSession>;
