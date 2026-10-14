import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import { sessionRequest, type CurrentMember, type SessionResponse } from "@family-hub/contract";

import { requireMember, type AuthService } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

type SessionEnv = { Variables: { auth: AuthService } };

export const sessionRoute = new Hono<SessionEnv>()
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
  .get("/api/me", requireMember, (context) => {
    const { memberId, memberName, familyId, familyName, isFamilyOwner } = context.var.membership;

    return context.json<CurrentMember>({
      member: { id: memberId, name: memberName },
      family: { id: familyId, name: familyName },
      isFamilyOwner,
    });
  });
