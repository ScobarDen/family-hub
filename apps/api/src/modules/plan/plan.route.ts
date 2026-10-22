import { Hono, type Context } from "hono";

import {
  planChange,
  subplanChange,
  type Plan,
  type PlanDeleted,
  type PlanList,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { PlanRefusal, PlanResult } from "./plan.types.ts";
import type { PlanService } from "./service/plan.service.ts";

type PlanEnv = {
  Variables: MemberEnv["Variables"] & { plans: PlanService };
};

const refuse = refusalsOf<PlanRefusal>({
  "not-found": {
    code: "PLAN_NOT_FOUND",
    message: "No such Plan or Subplan you can see",
    status: httpStatus.notFound,
  },
  "not-owner": {
    code: "NOT_PLAN_OWNER",
    message: "Only the Plan's owner may delete it",
    status: httpStatus.forbidden,
  },
  "assignee-not-allowed": {
    code: "ASSIGNEE_NOT_ALLOWED",
    message: "The Assignee is a Member of the Family; of a Private Plan, only its owner",
    status: httpStatus.badRequest,
  },
  "pet-not-found": {
    code: "PET_NOT_FOUND",
    message: "The Plan's Pet is not a Pet of the Family",
    status: httpStatus.badRequest,
  },
  "album-not-found": {
    code: "ALBUM_NOT_IN_FAMILY",
    message: "The Plan's Album is not an Album of the Family",
    status: httpStatus.badRequest,
  },
  "visibility-one-way": {
    code: "VISIBILITY_ONE_WAY",
    message: "A Shared Plan cannot become Private",
    status: httpStatus.conflict,
  },
});

function reply(context: Context<PlanEnv>, result: PlanResult) {
  return result.status === "ok" ? context.json<Plan>(result.plan) : refuse(context, result.status);
}

function subplanOf(context: Context<PlanEnv>) {
  return { planId: context.req.param("id") ?? "", subplanId: context.req.param("subplanId") ?? "" };
}

const subplanPath = "/api/plans/:id/subplans/:subplanId";

export const planRoute = new Hono<PlanEnv>()
  .use("/api/plans/*", requireMember)
  .get("/api/plans", async (context) =>
    context.json<PlanList>(await context.var.plans.list(context.var.membership)),
  )
  .post(
    "/api/plans",
    jsonBody(planChange, "A title is required; dates are YYYY-MM-DD"),
    async (context) => {
      const result = await context.var.plans.create(
        context.var.membership,
        context.req.valid("json"),
      );

      return result.status === "ok"
        ? context.json<Plan>(result.plan, httpStatus.created)
        : refuse(context, result.status);
    },
  )
  .put(
    "/api/plans/:id",
    jsonBody(planChange, "A title is required; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.plans.update(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json"),
        ),
      ),
  )
  .delete("/api/plans/:id", async (context) => {
    const result = await context.var.plans.remove(context.var.membership, context.req.param("id"));

    return result.status === "deleted"
      ? context.json<PlanDeleted>(result)
      : refuse(context, result.status);
  })
  .post("/api/plans/:id/complete", async (context) =>
    reply(
      context,
      await context.var.plans.complete(context.var.membership, context.req.param("id")),
    ),
  )
  .post("/api/plans/:id/reopen", async (context) =>
    reply(context, await context.var.plans.reopen(context.var.membership, context.req.param("id"))),
  )
  .post(
    "/api/plans/:id/subplans",
    jsonBody(subplanChange, "A title is required; dates are YYYY-MM-DD"),
    async (context) => {
      const result = await context.var.plans.addSubplan(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      );

      return result.status === "ok"
        ? context.json<Plan>(result.plan, httpStatus.created)
        : refuse(context, result.status);
    },
  )
  .put(
    subplanPath,
    jsonBody(subplanChange, "A title is required; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.plans.updateSubplan(
          context.var.membership,
          subplanOf(context),
          context.req.valid("json"),
        ),
      ),
  )
  .delete(subplanPath, async (context) =>
    reply(
      context,
      await context.var.plans.removeSubplan(context.var.membership, subplanOf(context)),
    ),
  )
  .post(`${subplanPath}/complete`, async (context) =>
    reply(
      context,
      await context.var.plans.markSubplan(context.var.membership, subplanOf(context), true),
    ),
  )
  .post(`${subplanPath}/reopen`, async (context) =>
    reply(
      context,
      await context.var.plans.markSubplan(context.var.membership, subplanOf(context), false),
    ),
  );
