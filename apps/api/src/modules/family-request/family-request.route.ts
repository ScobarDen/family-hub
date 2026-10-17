import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import { familyRequestBody, type ErrorCode, type FamilyRequestCreated } from "@family-hub/contract";

import type { AuthEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { FamilyRequestService, SubmitResult } from "./family-request.service.ts";

export type FamilyRequestEnv = {
  Variables: AuthEnv["Variables"] & { familyRequests: FamilyRequestService };
};

type Refusal = Exclude<SubmitResult["status"], "pending">;

const refusals = {
  "already-member": {
    code: "ALREADY_MEMBER",
    message: "Already a Member of a Family",
    status: httpStatus.conflict,
  },
  "already-pending": {
    code: "FAMILY_REQUEST_PENDING",
    message: "A Family Request is already pending",
    status: httpStatus.conflict,
  },
  cooldown: {
    code: "FAMILY_REQUEST_COOLDOWN",
    message: "A rejected Family Request can be repeated after 7 days",
    status: httpStatus.tooManyRequests,
  },
  "operator-unavailable": {
    code: "OPERATOR_UNAVAILABLE",
    message: "The Operator cannot be reached",
    status: httpStatus.serviceUnavailable,
  },
} as const satisfies Record<Refusal, { code: ErrorCode; message: string; status: number }>;

export const familyRequestRoute = new Hono<FamilyRequestEnv>().post(
  "/api/family-requests",
  sValidator("json", familyRequestBody, (result, context) =>
    result.success
      ? undefined
      : context.json(
          apiError("INVALID_REQUEST", "initData and a family name are required"),
          httpStatus.badRequest,
        ),
  ),
  async (context) => {
    const { initData, familyName } = context.req.valid("json");
    const user = await context.var.auth.identify(initData);

    if (!user) {
      return context.json(
        apiError("INIT_DATA_INVALID", "initData is forged or expired"),
        httpStatus.unauthorized,
      );
    }

    const result = await context.var.familyRequests.submit(user, familyName);

    if (result.status === "pending") {
      return context.json<FamilyRequestCreated>(result, httpStatus.created);
    }

    const { code, message, status } = refusals[result.status];

    return context.json(apiError(code, message), status);
  },
);
