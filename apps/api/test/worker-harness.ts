import type { Update } from "@grammyjs/types";
import { createWorker } from "@/app/worker.ts";
import { createFakeBotApi } from "./fake-bot-api.ts";
import { createFakeClock } from "./fake-clock.ts";
import { createMigratedSqliteD1 } from "./sqlite-d1.ts";

const origin = "https://api.family-hub.test";

type IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

export function startWorker({ now = "2026-10-04T09:00:00Z" }: { now?: string } = {}) {
  const clock = createFakeClock(now);
  const bot = createFakeBotApi();
  const env: Env = {
    DB: createMigratedSqliteD1(),
    BOT_TOKEN: "test-bot-token",
    JWT_SECRET: "test-jwt-secret",
    WEBHOOK_SECRET: "test-webhook-secret",
    OPERATOR_TELEGRAM_ID: "1000",
  };
  const worker = createWorker({ clock, createBotApi: () => bot.api });

  const withContext = async <T>(handle: (ctx: ExecutionContext) => T | Promise<T>) => {
    const background: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => void background.push(promise),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;
    const result = await handle(ctx);
    await Promise.all(background);
    return result;
  };

  const request = (path: string, init?: RequestInit) =>
    withContext((ctx) =>
      worker.fetch(new Request(new URL(path, origin), init) as IncomingRequest, env, ctx),
    );

  return {
    env,
    clock,
    bot,
    request,
    webhook: (update: Update, { secret = env.WEBHOOK_SECRET }: { secret?: string } = {}) =>
      request("/bot/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": secret,
        },
        body: JSON.stringify(update),
      }),
    tick: () =>
      withContext((ctx) =>
        worker.scheduled(
          { scheduledTime: clock.now(), cron: "* * * * *", noRetry: () => {} },
          env,
          ctx,
        ),
      ),
  };
}
