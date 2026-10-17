import { wrap } from "@reatom/core";

import { familyRequestCreated, type ErrorCode } from "@family-hub/contract";

import { HttpError, type HttpClient } from "@/common/http-client";

export type SubmitOutcome = "sent" | "already-pending" | "cooldown" | "already-member";

const refusals: Partial<Record<ErrorCode, SubmitOutcome>> = {
  FAMILY_REQUEST_PENDING: "already-pending",
  FAMILY_REQUEST_COOLDOWN: "cooldown",
  ALREADY_MEMBER: "already-member",
};

function refusalOf(error: unknown): SubmitOutcome | undefined {
  return error instanceof HttpError && error.code !== undefined ? refusals[error.code] : undefined;
}

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
        const refusal = refusalOf(error);

        if (refusal === undefined) {
          throw error;
        }

        return refusal;
      }
    },
  };
}

export type FamilyRequestApi = ReturnType<typeof createFamilyRequestApi>;
