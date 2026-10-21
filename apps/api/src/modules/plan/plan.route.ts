import { sValidator } from "@hono/standard-validator";
import { Hono, type Context } from "hono";

import {
  planChange,
  subplanChange,
  type ErrorCode,
  type Plan,
  type PlanDeleted,
  type PlanList,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { PlanRefusal, PlanResult } from "./plan.types.ts";
import type { PlanService } from "./service/plan.service.ts";

export type PlanEnv = {
  Variables: MemberEnv["Variables"] & { plans: PlanService };
};

const refusals = {
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
  "visibility-one-way": {
    code: "VISIBILITY_ONE_WAY",
    message: "A Shared Plan cannot become Private",
    status: httpStatus.conflict,
  },
} as const satisfies Record<PlanRefusal, { code: ErrorCode; message: string; status: number }>;

function refuse(context: Context<PlanEnv>, refusal: PlanRefusal) {
  const { code, message, status } = refusals[refusal];

  return context.json(apiError(code, message), status);
}

function reply(context: Context<PlanEnv>, result: PlanResult) {
  return result.status === "ok" ? context.json<Plan>(result.plan) : refuse(context, result.status);
}

function bodyOf<Schema extends typeof planChange | typeof subplanChange>(schema: Schema) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(
          apiError("INVALID_REQUEST", "A title is required; dates are YYYY-MM-DD"),
          httpStatus.badRequest,
        ),
  );
}

function subplanOf(context: Context<PlanEnv>) {
  return { planId: context.req.param("id") ?? "", subplanId: context.req.param("subplanId") ?? "" };
}

const subplanPath = "/api/plans/:id/subplans/:subplanId";

export const planRoute = new Hono<PlanEnv>()
  .use("/api/plans/*", requireMember)
  .use("/api/plans", requireMember)
  .get("/api/plans", async (context) =>
    context.json<PlanList>(await context.var.plans.list(context.var.membership)),
  )
  .post("/api/plans", bodyOf(planChange), async (context) => {
    const result = await context.var.plans.create(
      context.var.membership,
      context.req.valid("json"),
    );

    return result.status === "ok"
      ? context.json<Plan>(result.plan, httpStatus.created)
      : refuse(context, result.status);
  })
  .put("/api/plans/:id", bodyOf(planChange), async (context) =>
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
  .post("/api/plans/:id/subplans", bodyOf(subplanChange), async (context) => {
    const result = await context.var.plans.addSubplan(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json"),
    );

    return result.status === "ok"
      ? context.json<Plan>(result.plan, httpStatus.created)
      : refuse(context, result.status);
  })
  .put(subplanPath, bodyOf(subplanChange), async (context) =>
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
