import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

import type { AuthEnv, Membership } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import { signalFamily } from "./live.api.ts";
import { modulesOfPath, tokenOfProtocols } from "./live.lib.ts";

type LiveEnv = {
  Bindings: Env;
  Variables: AuthEnv["Variables"] & { membership?: Membership };
};

const upgradeRequired = 426;

export const liveRoute = new Hono<LiveEnv>().get("/api/live", async (context) => {
  if (context.req.header("upgrade") !== "websocket") {
    return context.body(null, upgradeRequired);
  }

  const token = tokenOfProtocols(context.req.header("sec-websocket-protocol"));
  const membership = token === undefined ? undefined : await context.var.auth.authenticate(token);

  if (!membership) {
    return context.json(
      apiError("UNAUTHENTICATED", "Session is missing or expired"),
      httpStatus.unauthorized,
    );
  }

  const opened = await context.env.LIVE.getByName(membership.family.id).fetch(context.req.raw);

  // The Object's headers are immutable, and the CORS middleware still writes its own.
  return new Response(null, {
    status: opened.status,
    webSocket: opened.webSocket,
    headers: new Headers(opened.headers),
  });
});

// Every successful write by a Member tells the Family's open apps which module to refetch.
export const signalWrites = createMiddleware<LiveEnv>(async (context, next) => {
  await next();

  const membership = context.get("membership");

  if (context.req.method === "GET" || !context.res.ok || membership === undefined) {
    return;
  }

  context.executionCtx.waitUntil(
    signalFamily(context.env.LIVE, {
      familyId: membership.family.id,
      modules: modulesOfPath(context.req.path),
    }),
  );
});
