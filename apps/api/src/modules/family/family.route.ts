import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import {
  familyDeletion,
  familyOwnerChange,
  type ErrorCode,
  type FamilyDeleted,
  type FamilyLeft,
  type FamilyOwnerChanged,
  type MemberRemoved,
} from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { FamilyService } from "./service/family.service.ts";

export type FamilyEnv = {
  Variables: AuthEnv["Variables"] & { families: FamilyService };
};

const refusals = {
  "not-owner": {
    code: "NOT_FAMILY_OWNER",
    message: "Only the Family Owner may do this",
    status: httpStatus.forbidden,
  },
  "not-found": {
    code: "MEMBER_NOT_FOUND",
    message: "No such other Member in the Family",
    status: httpStatus.notFound,
  },
  "must-hand-over": {
    code: "OWNER_MUST_HAND_OVER",
    message: "The Family Owner hands the role to another Member before leaving",
    status: httpStatus.conflict,
  },
  "name-mismatch": {
    code: "FAMILY_NAME_MISMATCH",
    message: "The typed name is not the Family's name",
    status: httpStatus.badRequest,
  },
} as const satisfies Record<string, { code: ErrorCode; message: string; status: number }>;

type Refusal = keyof typeof refusals;

function bodyOf<Schema extends typeof familyOwnerChange | typeof familyDeletion>(
  schema: Schema,
  message: string,
) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(apiError("INVALID_REQUEST", message), httpStatus.badRequest),
  );
}

function refusalOf(status: Refusal) {
  const { code, message } = refusals[status];

  return { body: apiError(code, message), status: refusals[status].status };
}

export const familyRoute = new Hono<FamilyEnv>()
  .post("/api/family/leave", requireMember, async (context) => {
    const result = await context.var.families.leave(context.var.membership);

    if (result.status === "must-hand-over") {
      const { body, status } = refusalOf(result.status);

      return context.json(body, status);
    }

    return context.json<FamilyLeft>(result);
  })
  .delete("/api/family/members/:id", requireMember, async (context) => {
    const result = await context.var.families.remove(
      context.var.membership,
      context.req.param("id"),
    );

    if (result.status !== "removed") {
      const { body, status } = refusalOf(result.status);

      return context.json(body, status);
    }

    return context.json<MemberRemoved>(result);
  })
  .put(
    "/api/family/owner",
    requireMember,
    bodyOf(familyOwnerChange, "The new Family Owner's memberId is required"),
    async (context) => {
      const result = await context.var.families.handOver(
        context.var.membership,
        context.req.valid("json").memberId,
      );

      if (result.status !== "handed-over") {
        const { body, status } = refusalOf(result.status);

        return context.json(body, status);
      }

      return context.json<FamilyOwnerChanged>(result);
    },
  )
  .delete(
    "/api/family",
    requireMember,
    bodyOf(familyDeletion, "The Family's name is required"),
    async (context) => {
      const result = await context.var.families.delete(
        context.var.membership,
        context.req.valid("json").familyName,
      );

      if (result.status !== "deleted") {
        const { body, status } = refusalOf(result.status);

        return context.json(body, status);
      }

      return context.json<FamilyDeleted>(result);
    },
  );
