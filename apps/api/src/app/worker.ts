import { Hono } from "hono";

import type { Clock } from "@/common/clock";
import { createDb } from "@/common/db";
import type { BotApi } from "@/common/telegram";

import type { AppEnv, AppServices } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

export type WorkerDependencies = {
  clock: Clock;
  createBotApi: (token: string) => BotApi;
};

export type Worker = Required<Pick<ExportedHandler<Env>, "fetch" | "scheduled">>;

export function createWorker({ clock, createBotApi }: WorkerDependencies): Worker {
  function servicesFor(env: Env): AppServices {
    return {
      db: createDb(env.DB),
      clock,
      bot: createBotApi(env.BOT_TOKEN),
    };
  }

  const app = new Hono<AppEnv>()
    .use(async (context, next) => {
      const services = servicesFor(context.env);

      context.set("db", services.db);
      context.set("clock", services.clock);
      context.set("bot", services.bot);
      await next();
    })
    .route("/", healthRoute)
    .route("/", webhookRoute);

  return {
    fetch: app.fetch,
    // oxlint-disable-next-line no-empty-function -- cron jobs arrive with Reminders
    async scheduled() {},
  };
}
