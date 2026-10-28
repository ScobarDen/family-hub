import { wrap } from "@reatom/core";

import { currentMember, sessionResponse } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createSessionApi(client: HttpClient) {
  return {
    async signIn(initData: string) {
      const session = await wrap(
        client.request("/api/session", {
          method: "POST",
          body: { initData },
          schema: sessionResponse,
        }),
      );

      if (session.status === "stranger") {
        return session;
      }

      client.token.set(session.token);

      return { status: session.status, member: currentMember.parse(session) };
    },
    isSessionLost: client.isSessionLost,
  };
}

export type SessionApi = ReturnType<typeof createSessionApi>;
