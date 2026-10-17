import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import {
  sessionRequest,
  type CurrentMember,
  type FamilyRequestStatus,
  type SessionResponse,
} from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

// Wired by the app to the family-request module, which modules may not import directly.
type SessionEnv = {
  Variables: AuthEnv["Variables"] & {
    familyRequests: { statusOf(telegramId: number): Promise<FamilyRequestStatus> };
  };
};

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

      if (result.status === "stranger") {
        return context.json<SessionResponse>({
          status: "stranger",
          familyRequest: await context.var.familyRequests.statusOf(result.telegramId),
        });
      }

      return context.json<SessionResponse>(result);
    },
  )
  .get("/api/me", requireMember, (context) => context.json<CurrentMember>(context.var.membership));
