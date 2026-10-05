import type { Update } from "@grammyjs/types";
import { vi } from "vite-plus/test";

import { createWorker } from "@/app/worker.ts";

import { createFakeBotApi } from "./fake-bot-api.ts";
import { createFakeClock } from "./fake-clock.ts";
import { createMigratedSqliteD1 } from "./sqlite-d1.ts";

const origin = "https://api.family-hub.test";

type IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function withContext<Result>(
  handle: (context: ExecutionContext) => Result | Promise<Result>,
): Promise<Result> {
  const background: Array<Promise<unknown>> = [];
  const context = {
    waitUntil: (promise: Promise<unknown>) => {
      background.push(promise);
    },
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;
  const result = await handle(context);

  await Promise.all(background);

  return result;
}

function createTestEnv(): Env {
  return {
    DB: createMigratedSqliteD1(),
    BOT_TOKEN: "test-bot-token",
    JWT_SECRET: "test-jwt-secret",
    WEBHOOK_SECRET: "test-webhook-secret",
    OPERATOR_TELEGRAM_ID: "1000",
  };
}

export function startWorker({ now = "2026-10-04T09:00:00Z" }: { now?: string } = {}) {
  const clock = createFakeClock(now);
  const bot = createFakeBotApi();
  const env = createTestEnv();
  const worker = createWorker({ clock, createBotApi: () => bot.api });

  async function request(path: string, init?: RequestInit) {
    return withContext((context) =>
      worker.fetch(new Request(new URL(path, origin), init) as IncomingRequest, env, context),
    );
  }

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
      withContext((context) =>
        worker.scheduled(
          { scheduledTime: clock.now(), cron: "* * * * *", noRetry: vi.fn() },
          env,
          context,
        ),
      ),
  };
}
