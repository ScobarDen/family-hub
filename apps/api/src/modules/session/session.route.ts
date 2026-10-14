import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import { sessionRequest, type CurrentMember, type SessionResponse } from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

export const sessionRoute = new Hono<AuthEnv>()
  .post(
    "/api/session",
    sValidator("json", sessionRequest, (result, context) =>
      result.success
        ? undefined
        : context.json(apiError("INVALID_REQUEST", "initData is required"), httpStatus.badRequest),
    ),
    async (context) => {
      const result = await context.var.auth.signIn(context.req.valid("json").initData);

      if (result.status === "invalid") {
        return context.json(
          apiError("INIT_DATA_INVALID", "initData is forged or expired"),
          httpStatus.unauthorized,
        );
      }

      return context.json<SessionResponse>(result);
    },
  )
  .get("/api/me", requireMember, (context) => context.json<CurrentMember>(context.var.membership));
