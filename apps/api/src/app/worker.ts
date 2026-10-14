import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuthService, createMembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import { createDb } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import { sessionRoute } from "@/modules/session";

import type { AppEnv, AppServices } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

export type WorkerDependencies = {
  clock: Clock;
  createBotApi: (token: string) => BotApi;
};

export type Worker = Required<Pick<ExportedHandler<Env>, "fetch" | "scheduled">>;

function allowedOrigin(origin: string, env: Env): string | null {
  return env.ALLOWED_ORIGINS.split(",").includes(origin) ? origin : null;
}

function createApp({ clock, createBotApi }: WorkerDependencies) {
  function servicesFor(env: Env): AppServices {
    const db = createDb(env.DB);

    return {
      db,
      clock,
      bot: createBotApi(env.BOT_TOKEN),
      auth: createAuthService({
        memberships: createMembershipRepo(db),
        clock,
        botToken: env.BOT_TOKEN,
        jwtSecret: env.JWT_SECRET,
      }),
    };
  }

  return new Hono<AppEnv>()
    .use("/api/*", cors({ origin: (origin, context) => allowedOrigin(origin, context.env) }))
    .use(async (context, next) => {
      const services = servicesFor(context.env);

      context.set("db", services.db);
      context.set("clock", services.clock);
      context.set("bot", services.bot);
      context.set("auth", services.auth);
      await next();
    })
    .route("/", healthRoute)
    .route("/", webhookRoute)
    .route("/", sessionRoute);
}

export type App = ReturnType<typeof createApp>;

export function createWorker(dependencies: WorkerDependencies): Worker {
  return {
    fetch: createApp(dependencies).fetch,
    // oxlint-disable-next-line no-empty-function -- cron jobs arrive with Reminders
    async scheduled() {},
  };
}
