import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

import {
  telegramLogin,
  type FamilyRequestStatus,
  type SessionResponse,
} from "@family-hub/contract";

import { apiError, httpStatus, jsonBody } from "@/common/errors";

import type { AuthService } from "./auth.service.ts";
import type { Membership } from "./auth.types.ts";

const bearerPrefix = "Bearer ";

export type AuthEnv = { Variables: { auth: AuthService } };

export type MemberEnv = { Variables: AuthEnv["Variables"] & { membership: Membership } };

export const requireMember = createMiddleware<MemberEnv>(async (context, next) => {
  const header = context.req.header("authorization") ?? "";
  const membership = header.startsWith(bearerPrefix)
    ? await context.var.auth.authenticate(header.slice(bearerPrefix.length))
    : undefined;

  if (!membership) {
    return context.json(
      apiError("UNAUTHENTICATED", "Session is missing or expired"),
      httpStatus.unauthorized,
    );
  }

  context.set("membership", membership);

  return next();
});

// Wired by the app to the family-request module, which modules may not import directly.
type SessionEnv = {
  Variables: AuthEnv["Variables"] & {
    familyRequests: { statusOf(telegramId: number): Promise<FamilyRequestStatus> };
  };
};

export const sessionRoute = new Hono<SessionEnv>().post(
  "/api/session",
  jsonBody(telegramLogin, "initData is required"),
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
);
