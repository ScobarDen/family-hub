import { Hono } from "hono";

import {
  familyDeletion,
  familyOwnerChange,
  type FamilyDeleted,
  type FamilyLeft,
  type FamilyOwnerChanged,
  type MemberRemoved,
} from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { FamilyService } from "./service/family.service.ts";

export type FamilyEnv = {
  Variables: AuthEnv["Variables"] & { families: FamilyService };
};

type FamilyRefusal = "not-owner" | "not-found" | "must-hand-over" | "name-mismatch";

const refuse = refusalsOf<FamilyRefusal>({
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
});

export const familyRoute = new Hono<FamilyEnv>()
  .post("/api/family/leave", requireMember, async (context) => {
    const result = await context.var.families.leave(context.var.membership);

    if (result.status === "must-hand-over") {
      return refuse(context, result.status);
    }

    return context.json<FamilyLeft>(result);
  })
  .delete("/api/family/members/:id", requireMember, async (context) => {
    const result = await context.var.families.remove(
      context.var.membership,
      context.req.param("id"),
    );

    if (result.status !== "removed") {
      return refuse(context, result.status);
    }

    return context.json<MemberRemoved>(result);
  })
  .put(
    "/api/family/owner",
    requireMember,
    jsonBody(familyOwnerChange, "The new Family Owner's memberId is required"),
    async (context) => {
      const result = await context.var.families.handOver(
        context.var.membership,
        context.req.valid("json").memberId,
      );

      if (result.status !== "handed-over") {
        return refuse(context, result.status);
      }

      return context.json<FamilyOwnerChanged>(result);
    },
  )
  .delete(
    "/api/family",
    requireMember,
    jsonBody(familyDeletion, "The Family's name is required"),
    async (context) => {
      const result = await context.var.families.delete(
        context.var.membership,
        context.req.valid("json").familyName,
      );

      if (result.status !== "deleted") {
        return refuse(context, result.status);
      }

      return context.json<FamilyDeleted>(result);
    },
  );
