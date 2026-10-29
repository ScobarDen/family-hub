import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  pushSubscription,
  type Deleted,
  type PushKey,
  type PushSubscriptionChange,
} from "@family-hub/contract";

import { httpStatus, jsonBody, refusalsOf } from "@/common/errors.lib.ts";
import { requireMember, type AuthEnv } from "@/modules/auth";

import type { PushService } from "./push.service.ts";

type PushEnv = { Variables: AuthEnv["Variables"] & { push: PushService } };

const refuse = refusalsOf({
  deviceNotFound: {
    code: "DEVICE_NOT_FOUND",
    message: "No such Device of this Member",
    status: httpStatus.notFound,
  },
});

const deviceParameter = sValidator("param", z.object({ id: z.string().min(1) }));

export const pushRoute = new Hono<PushEnv>()
  .get("/api/push/key", requireMember, async (context) =>
    context.json<PushKey>({ publicKey: context.var.push.publicKey() }),
  )
  .put(
    "/api/devices/:id/push",
    requireMember,
    deviceParameter,
    jsonBody(pushSubscription, "A push subscription with its endpoint and keys is required"),
    async (context) =>
      (await context.var.push.subscribe(context.var.membership, {
        deviceId: context.req.valid("param").id,
        subscription: context.req.valid("json"),
      })) === "subscribed"
        ? context.json<PushSubscriptionChange>(context.req.valid("json"))
        : refuse(context, "deviceNotFound"),
  )
  .delete("/api/devices/:id/push", requireMember, deviceParameter, async (context) => {
    await context.var.push.unsubscribe(context.var.membership, context.req.valid("param").id);

    return context.json<Deleted>({ status: "deleted" });
  });
