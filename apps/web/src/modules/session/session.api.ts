import { wrap } from "@reatom/core";

import { currentMember, sessionResponse, type SessionResponse } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createSessionApi(client: HttpClient) {
  return {
    async signIn(initData: string): Promise<SessionResponse> {
      const session = await wrap(
        client.request("/api/session", {
          method: "POST",
          body: { initData },
          schema: sessionResponse,
        }),
      );

      if (session.status === "member") {
        client.token.set(session.token);
      }

      return session;
    },
    currentMember: async () => client.request("/api/me", { schema: currentMember }),
    isSessionLost: client.isSessionLost,
  };
}

export type SessionApi = ReturnType<typeof createSessionApi>;
