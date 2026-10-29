import { wrap } from "@reatom/core";

import { inviteAccepted, invitePreview, type ErrorCode } from "@family-hub/contract";

import { refusalOf, type HttpClient } from "@/common/http-client.api.ts";

export type AcceptOutcome = "joined" | "unavailable" | "already-member";

const refusals: Partial<Record<ErrorCode, AcceptOutcome>> = {
  INVITE_UNAVAILABLE: "unavailable",
  ALREADY_MEMBER: "already-member",
};

export function createJoinFamilyApi(client: HttpClient) {
  return {
    preview: async (initData: string, token: string) =>
      client.request(`/api/invites/${token}/preview`, {
        method: "POST",
        body: { initData },
        withoutSession: true,
        schema: invitePreview,
      }),

    async accept(initData: string, token: string): Promise<AcceptOutcome> {
      try {
        await wrap(
          client.request(`/api/invites/${token}/accept`, {
            method: "POST",
            body: { initData },
            withoutSession: true,
            schema: inviteAccepted,
          }),
        );

        return "joined";
      } catch (error) {
        const refusal = refusalOf(error, refusals);

        if (refusal === undefined) {
          throw error;
        }

        return refusal;
      }
    },
  };
}

export type JoinFamilyApi = ReturnType<typeof createJoinFamilyApi>;
