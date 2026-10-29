import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

import {
  deviceCredential,
  telegramLogin,
  telegramWidgetLogin,
  type CurrentMember,
  type Deleted,
  type DeviceList,
  type DeviceSession,
  type DeviceSignIn,
  type FamilyRequestStatus,
  type SessionResponse,
  type SessionToken,
} from "@family-hub/contract";

import { apiError, httpStatus, jsonBody, refusalsOf } from "@/common/errors.lib.ts";

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

// Wired by the app to the family-request and member modules, which common code may not import.
type SessionEnv = {
  Variables: AuthEnv["Variables"] & {
    familyRequests: { statusOf(telegramId: number): Promise<FamilyRequestStatus> };
    members: { current(membership: Membership): Promise<CurrentMember> };
  };
};

const refuse = refusalsOf({
  loginInvalid: {
    code: "TELEGRAM_LOGIN_INVALID",
    message: "The Telegram Login is forged or expired",
    status: httpStatus.unauthorized,
  },
  deviceInvalid: {
    code: "DEVICE_INVALID",
    message: "The Device is revoked or expired",
    status: httpStatus.unauthorized,
  },
  stranger: {
    code: "NOT_A_MEMBER",
    message: "Only Members of a Family sign in to the Installed App",
    status: httpStatus.forbidden,
  },
  deviceNotFound: {
    code: "DEVICE_NOT_FOUND",
    message: "No such Device of this Member",
    status: httpStatus.notFound,
  },
});

const deviceParameter = sValidator("param", z.object({ id: z.string().min(1) }));

export const sessionRoute = new Hono<SessionEnv>()
  .post("/api/session", jsonBody(telegramLogin, "initData is required"), async (context) => {
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

    return context.json<SessionResponse>({
      status: "member",
      token: result.token,
      ...(await context.var.members.current(result.membership)),
    });
  })
  .post(
    "/api/session/telegram-login",
    jsonBody(telegramWidgetLogin, "A Telegram Login is required"),
    async (context) => {
      const result = await context.var.auth.signInWithLogin(
        context.req.valid("json"),
        context.req.header("user-agent"),
      );

      if (result.status === "invalid") {
        return refuse(context, "loginInvalid");
      }

      if (result.status === "stranger") {
        return refuse(context, "stranger");
      }

      return context.json<DeviceSignIn>({
        token: result.token,
        device: result.device,
        ...(await context.var.members.current(result.membership)),
      });
    },
  )
  .post(
    "/api/session/device",
    jsonBody(deviceCredential, "A Device credential is required"),
    async (context) => {
      const result = await context.var.auth.signInWithDevice(context.req.valid("json").credential);

      if (result.status === "invalid") {
        return refuse(context, "deviceInvalid");
      }

      if (result.status === "stranger") {
        return refuse(context, "stranger");
      }

      return context.json<DeviceSession>({
        token: result.token,
        ...(await context.var.members.current(result.membership)),
      });
    },
  )
  .get("/api/devices", requireMember, async (context) =>
    context.json<DeviceList>(await context.var.auth.devicesOf(context.var.membership)),
  )
  .delete("/api/devices/:id", requireMember, deviceParameter, async (context) =>
    (await context.var.auth.revokeDevice(context.var.membership, context.req.valid("param").id))
      ? context.json<Deleted>({ status: "deleted" })
      : refuse(context, "deviceNotFound"),
  )
  .post("/api/session/renew", requireMember, async (context) =>
    context.json<SessionToken>({
      token: await context.var.auth.renew(context.var.membership),
    }),
  );
