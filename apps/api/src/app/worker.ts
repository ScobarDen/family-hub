import { Hono } from "hono";
import type { Clock } from "@/common/clock";
import { createDb } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { AppEnv, AppServices } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

export type WorkerDeps = {
  clock: Clock;
  createBotApi: (token: string) => BotApi;
};

export type Worker = Required<Pick<ExportedHandler<Env>, "fetch" | "scheduled">>;

export function createWorker({ clock, createBotApi }: WorkerDeps): Worker {
  const servicesFor = (env: Env): AppServices => ({
    db: createDb(env.DB),
    clock,
    bot: createBotApi(env.BOT_TOKEN),
  });

  const app = new Hono<AppEnv>()
    .use(async (c, next) => {
      const services = servicesFor(c.env);
      c.set("db", services.db);
      c.set("clock", services.clock);
      c.set("bot", services.bot);
      await next();
    })
    .route("/", healthRoute)
    .route("/", webhookRoute);

  return {
    fetch: app.fetch,
    async scheduled() {},
  };
}
