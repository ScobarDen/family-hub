import type { Update } from "@grammyjs/types";
import { vi } from "vite-plus/test";

import { createWorker } from "@/app/worker.ts";

import { createFakeAi, type FakeAi } from "./fake-ai.ts";
import { createFakeBotApi } from "./fake-bot-api.ts";
import { createFakeClock } from "./fake-clock.ts";
import { createFamilyFixtures } from "./family-fixtures.ts";
import { signInitData, type TelegramUserFixture } from "./init-data.ts";
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

function createTestEnv(ai: FakeAi): Env {
  return {
    DB: createMigratedSqliteD1(),
    BOT_TOKEN: "test-bot-token",
    JWT_SECRET: "test-jwt-secret",
    WEBHOOK_SECRET: "test-webhook-secret",
    OPERATOR_TELEGRAM_ID: "1000",
    ALLOWED_ORIGINS: "https://scobarden.github.io,http://localhost:5173",
    MINI_APP_URL: "https://scobarden.github.io/family-hub/",
    AI: ai.binding,
    AI_COMMAND_MODEL: "primary-model",
    AI_COMMAND_MODEL_FALLBACK: "fallback-model",
    AI_SPEECH_MODEL: "speech-model",
    AI_COMMANDS_PER_FAMILY_DAY: "3",
  };
}

function createEdgeCache() {
  const stored = new Map<string, Response>();

  return {
    match: async (key: Request) => stored.get(key.url)?.clone(),
    put: async (key: Request, response: Response) => {
      stored.set(key.url, response);
    },
  };
}

export const denis = { id: 111, first_name: "Денис" };
export const asya = { id: 222, first_name: "Ася" };

export async function tokenOf(worker: Worker, user: TelegramUserFixture): Promise<string> {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({
        botToken: worker.env.BOT_TOKEN,
        user,
        authDate: worker.clock.iso(),
      }),
    }),
  });
  const { token = "" } = await session.json<{ token?: string }>();

  return token;
}

// What the Mini App sends as this Member: their session token and a JSON body.
export async function request(
  worker: Worker,
  user: TelegramUserFixture,
  { method = "GET", path, body }: { method?: string; path: string; body?: unknown },
): Promise<Response> {
  return worker.request(path, {
    method,
    headers: {
      authorization: `Bearer ${await tokenOf(worker, user)}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type Worker = ReturnType<typeof startWorker>;

export function startWorker({ now = "2026-10-04T09:00:00Z" }: { now?: string } = {}) {
  vi.stubGlobal("caches", { default: createEdgeCache() });

  const clock = createFakeClock(now);
  const bot = createFakeBotApi();
  const ai = createFakeAi();
  const env = createTestEnv(ai);
  const worker = createWorker({ clock, createBotApi: () => bot.api });

  async function fetchPath(path: string, init?: RequestInit) {
    return withContext((context) =>
      worker.fetch(new Request(new URL(path, origin), init) as IncomingRequest, env, context),
    );
  }

  return {
    env,
    clock,
    bot,
    ai,
    request: fetchPath,
    ...createFamilyFixtures(env.DB, clock),
    webhook: (update: Update, { secret = env.WEBHOOK_SECRET }: { secret?: string } = {}) =>
      fetchPath("/bot/webhook", {
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
