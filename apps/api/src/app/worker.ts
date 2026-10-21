import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuthService, createMembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import { createDb } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import { createFamilyRepo, createFamilyService, familyRoute } from "@/modules/family";
import {
  createFamilyRequestRepo,
  createFamilyRequestService,
  familyRequestRoute,
} from "@/modules/family-request";
import { createInviteRepo, createInviteService, inviteRoute } from "@/modules/invite";
import { createMemberRepo, createMemberService, memberRoute } from "@/modules/member";
import { createPetRepo, createPetService, petRoute } from "@/modules/pet";
import { sessionRoute } from "@/modules/session";

import type { AppEnv, AppServices } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

export type WorkerDependencies = {
  clock: Clock;
  createBotApi: (token: string) => BotApi;
};

export type Worker = Required<Pick<ExportedHandler<Env>, "fetch" | "scheduled">>;

function operatorTelegramIdOf(env: Env): number {
  const id = Number(env.OPERATOR_TELEGRAM_ID);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("OPERATOR_TELEGRAM_ID must be the Operator's Telegram user id");
  }

  return id;
}

function allowedOrigin(origin: string, env: Env): string | null {
  return env.ALLOWED_ORIGINS.split(",").includes(origin) ? origin : null;
}

function servicesFor(env: Env, { clock, createBotApi }: WorkerDependencies): AppServices {
  const db = createDb(env.DB);
  const bot = createBotApi(env.BOT_TOKEN);
  const memberships = createMembershipRepo(db);
  const familyRequests = createFamilyRequestService({
    requests: createFamilyRequestRepo(db),
    memberships,
    bot,
    clock,
    operatorTelegramId: operatorTelegramIdOf(env),
    miniAppUrl: env.MINI_APP_URL,
  });

  return {
    db,
    clock,
    bot,
    auth: createAuthService({
      memberships,
      clock,
      botToken: env.BOT_TOKEN,
      jwtSecret: env.JWT_SECRET,
    }),
    families: createFamilyService({ families: createFamilyRepo(db), bot, clock }),
    familyRequests,
    invites: createInviteService({
      invites: createInviteRepo(db),
      memberships,
      familyRequests,
      bot,
      clock,
    }),
    members: createMemberService({ members: createMemberRepo(db), clock }),
    pets: createPetService({ pets: createPetRepo(db), clock }),
  };
}

function createApp(dependencies: WorkerDependencies) {
  return new Hono<AppEnv>()
    .use("/api/*", cors({ origin: (origin, context) => allowedOrigin(origin, context.env) }))
    .use(async (context, next) => {
      const services = servicesFor(context.env, dependencies);

      context.set("db", services.db);
      context.set("clock", services.clock);
      context.set("bot", services.bot);
      context.set("auth", services.auth);
      context.set("families", services.families);
      context.set("familyRequests", services.familyRequests);
      context.set("invites", services.invites);
      context.set("members", services.members);
      context.set("pets", services.pets);
      await next();
    })
    .route("/", healthRoute)
    .route("/", webhookRoute)
    .route("/", sessionRoute)
    .route("/", familyRequestRoute)
    .route("/", inviteRoute)
    .route("/", memberRoute)
    .route("/", familyRoute)
    .route("/", petRoute);
}

export function createWorker(dependencies: WorkerDependencies): Worker {
  return {
    fetch: createApp(dependencies).fetch,
    // oxlint-disable-next-line no-empty-function -- cron jobs arrive with Reminders
    async scheduled() {},
  };
}
