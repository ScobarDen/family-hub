import { wrap } from "@reatom/core";

import { currentMember, sessionResponse } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client.api.ts";

export function createSessionApi(client: HttpClient) {
  return {
    async signIn(initData: string) {
      const session = await wrap(
        client.request("/api/session", {
          method: "POST",
          body: { initData },
          withoutSession: true,
          schema: sessionResponse,
        }),
      );

      return session.status === "stranger"
        ? session
        : { status: session.status, member: currentMember.parse(session), token: session.token };
    },
    startSession: (token: string) => {
      client.token.set(token);
    },
    isSessionLost: client.isSessionLost,
  };
}

export type SessionApi = ReturnType<typeof createSessionApi>;
