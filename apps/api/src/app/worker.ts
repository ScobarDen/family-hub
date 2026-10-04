import { Hono } from "hono";
import type { Clock } from "@/common/clock";
import { createDb } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { AppEnv } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

export type WorkerDeps = {
  clock: Clock;
  createBotApi: (token: string) => BotApi;
};

export type Worker = Required<Pick<ExportedHandler<Env>, "fetch" | "scheduled">>;

export function createWorker({ clock, createBotApi }: WorkerDeps): Worker {
  const app = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set("db", createDb(c.env.DB));
      c.set("clock", clock);
      c.set("bot", createBotApi(c.env.BOT_TOKEN));
      await next();
    })
    .route("/", healthRoute)
    .route("/", webhookRoute);

  return {
    fetch: app.fetch,
    async scheduled() {},
  };
}
