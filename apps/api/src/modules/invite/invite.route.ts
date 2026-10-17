import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  inviteRequest,
  inviteToken,
  type ErrorCode,
  type InviteAccepted,
  type InviteCreated,
  type InviteList,
  type InvitePreview,
  type InviteRevoked,
} from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { AcceptResult, InviteService } from "./service/invite.service.ts";

export type InviteEnv = {
  Variables: AuthEnv["Variables"] & { invites: InviteService };
};

type Refusal = Exclude<AcceptResult["status"], "joined">;

const refusals = {
  unavailable: {
    code: "INVITE_UNAVAILABLE",
    message: "The Invite is used, expired or revoked",
    status: httpStatus.gone,
  },
  "already-member": {
    code: "ALREADY_MEMBER",
    message: "Already a Member of a Family",
    status: httpStatus.conflict,
  },
} as const satisfies Record<Refusal, { code: ErrorCode; message: string; status: number }>;

const invalidRequest = apiError("INVALID_REQUEST", "initData and an Invite token are required");

const byInitData = [
  sValidator("param", z.object({ token: inviteToken }), (result, context) =>
    result.success ? undefined : context.json(invalidRequest, httpStatus.badRequest),
  ),
  sValidator("json", inviteRequest, (result, context) =>
    result.success ? undefined : context.json(invalidRequest, httpStatus.badRequest),
  ),
] as const;

const initDataInvalid = apiError("INIT_DATA_INVALID", "initData is forged or expired");

export const inviteRoute = new Hono<InviteEnv>()
  .post("/api/invites", requireMember, async (context) =>
    context.json<InviteCreated>(
      await context.var.invites.create(context.var.membership),
      httpStatus.created,
    ),
  )
  .get("/api/invites", requireMember, async (context) =>
    context.json<InviteList>(await context.var.invites.listOpen(context.var.membership)),
  )
  .delete("/api/invites/:id", requireMember, async (context) => {
    const result = await context.var.invites.revoke(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "revoked"
      ? context.json<InviteRevoked>(result)
      : context.json(
          apiError("INVITE_NOT_FOUND", "No such open Invite of yours"),
          httpStatus.notFound,
        );
  })
  .post("/api/invites/:token/preview", ...byInitData, async (context) => {
    const user = await context.var.auth.identify(context.req.valid("json").initData);

    if (!user) {
      return context.json(initDataInvalid, httpStatus.unauthorized);
    }

    return context.json<InvitePreview>(
      await context.var.invites.preview(user, context.req.valid("param").token),
    );
  })
  .post("/api/invites/:token/accept", ...byInitData, async (context) => {
    const user = await context.var.auth.identify(context.req.valid("json").initData);

    if (!user) {
      return context.json(initDataInvalid, httpStatus.unauthorized);
    }

    const result = await context.var.invites.accept(user, context.req.valid("param").token);

    if (result.status === "joined") {
      return context.json<InviteAccepted>(result);
    }

    const { code, message, status } = refusals[result.status];

    return context.json(apiError(code, message), status);
  });
