import { action, withAsyncData, wrap } from "@reatom/core";

import type { CurrentMember, FamilyRequestStatus } from "@family-hub/contract";

import type { SessionApi } from "./session.api.ts";

export type SignInOutcome =
  | { status: "outside-telegram" }
  | { status: "stranger"; familyRequest: FamilyRequestStatus }
  | { status: "member"; member: CurrentMember };

export function reatomSignIn({ api, initData }: { api: SessionApi; initData: string }) {
  return action(async (): Promise<SignInOutcome> => {
    if (initData === "") {
      return { status: "outside-telegram" };
    }

    const session = await wrap(api.signIn(initData));

    if (session.status === "stranger") {
      return session;
    }

    return { status: "member", member: await wrap(api.currentMember()) };
  }, "session.signIn").extend(withAsyncData());
}
