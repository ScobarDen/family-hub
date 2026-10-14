import { createMiddleware } from "hono/factory";

import { apiError, httpStatus } from "@/common/errors";

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
