import { Hono } from "hono";

import { familyRequestBody, type FamilyRequestCreated } from "@family-hub/contract";

import { apiError, httpStatus, jsonBody, refusalsOf } from "@/common/errors.lib.ts";
import type { AuthEnv } from "@/modules/auth";

import type { FamilyRequestService, SubmitResult } from "./service/family-request.service.ts";

type FamilyRequestEnv = {
  Variables: AuthEnv["Variables"] & { familyRequests: FamilyRequestService };
};

type Refusal = Exclude<SubmitResult["status"], "pending">;

const refuse = refusalsOf<Refusal>({
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
});

export const familyRequestRoute = new Hono<FamilyRequestEnv>().post(
  "/api/family-requests",
  jsonBody(familyRequestBody, "initData and a family name are required"),
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

    return refuse(context, result.status);
  },
);
