import { Hono, type Context } from "hono";

import {
  goalChange,
  goalCompletion,
  movementChange,
  type Goal,
  type GoalList,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { GoalRefusal, GoalResult } from "./goal.types.ts";
import type { GoalService } from "./service/goal.service.ts";

type GoalEnv = {
  Variables: MemberEnv["Variables"] & { goals: GoalService };
};

const refuse = refusalsOf<GoalRefusal>({
  "not-found": {
    code: "GOAL_NOT_FOUND",
    message: "No such Savings Goal you can see",
    status: httpStatus.notFound,
  },
  completed: {
    code: "GOAL_COMPLETED",
    message: "A Completed Goal is read-only",
    status: httpStatus.conflict,
  },
  "visibility-one-way": {
    code: "VISIBILITY_ONE_WAY",
    message: "A Shared Goal cannot become Private",
    status: httpStatus.conflict,
  },
  "movement-not-found": {
    code: "MOVEMENT_NOT_FOUND",
    message: "No such Contribution or Withdrawal in this Goal",
    status: httpStatus.notFound,
  },
  "not-author": {
    code: "NOT_MOVEMENT_AUTHOR",
    message: "Only the Member who recorded it may change it",
    status: httpStatus.forbidden,
  },
  "balance-negative": {
    code: "BALANCE_NEGATIVE",
    message: "A Goal's Balance never goes below zero",
    status: httpStatus.conflict,
  },
  "contributor-not-allowed": {
    code: "CONTRIBUTOR_NOT_ALLOWED",
    message: "The money is a Family Member's; of a Private Goal, only its owner's",
    status: httpStatus.badRequest,
  },
});

function reply(context: Context<GoalEnv>, result: GoalResult, created?: typeof httpStatus.created) {
  if (result.status === "ok") {
    return created === undefined
      ? context.json<Goal>(result.goal)
      : context.json<Goal>(result.goal, created);
  }

  return refuse(context, result.status);
}

function movementOf(context: Context<GoalEnv>) {
  return {
    goalId: context.req.param("id") ?? "",
    movementId: context.req.param("movementId") ?? "",
  };
}

const movementPath = "/api/goals/:id/movements/:movementId";

export const goalRoute = new Hono<GoalEnv>()
  .use("/api/goals/*", requireMember)
  .get("/api/goals", async (context) =>
    context.json<GoalList>(await context.var.goals.list(context.var.membership)),
  )
  .post(
    "/api/goals",
    jsonBody(goalChange, "Amounts are whole rubles above zero; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.goals.create(context.var.membership, context.req.valid("json")),
        httpStatus.created,
      ),
  )
  .put(
    "/api/goals/:id",
    jsonBody(goalChange, "Amounts are whole rubles above zero; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.goals.update(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json"),
        ),
      ),
  )
  .post(
    "/api/goals/:id/complete",
    jsonBody(goalCompletion, "Amounts are whole rubles above zero; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.goals.complete(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json").outcome,
        ),
      ),
  )
  .post(
    "/api/goals/:id/movements",
    jsonBody(movementChange, "Amounts are whole rubles above zero; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.goals.addMovement(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json"),
        ),
        httpStatus.created,
      ),
  )
  .put(
    movementPath,
    jsonBody(movementChange, "Amounts are whole rubles above zero; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.goals.updateMovement(
          context.var.membership,
          movementOf(context),
          context.req.valid("json"),
        ),
      ),
  )
  .delete(movementPath, async (context) =>
    reply(
      context,
      await context.var.goals.removeMovement(context.var.membership, movementOf(context)),
    ),
  );
