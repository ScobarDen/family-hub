import { wrap } from "@reatom/core";

import { familyRequestCreated, type ErrorCode } from "@family-hub/contract";

import { refusalOf, type HttpClient } from "@/common/http-client";

export type SubmitOutcome = "sent" | "already-pending" | "cooldown" | "already-member";

const refusals: Partial<Record<ErrorCode, SubmitOutcome>> = {
  FAMILY_REQUEST_PENDING: "already-pending",
  FAMILY_REQUEST_COOLDOWN: "cooldown",
  ALREADY_MEMBER: "already-member",
};

export function createFamilyRequestApi(client: HttpClient) {
  return {
    async submit(initData: string, familyName: string): Promise<SubmitOutcome> {
      try {
        await wrap(
          client.request("/api/family-requests", {
            method: "POST",
            body: { initData, familyName },
            schema: familyRequestCreated,
          }),
        );

        return "sent";
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

export type FamilyRequestApi = ReturnType<typeof createFamilyRequestApi>;
