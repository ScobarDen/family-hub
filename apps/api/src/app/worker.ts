import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

import { createAuthService, createMembershipRepo, type MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import { createDb, type Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import { careEntryRoute, createCareEntryRepo, createCareEntryService } from "@/modules/care-entry";
import { createEventRepo, createEventService, eventRoute } from "@/modules/event";
import { createFamilyRepo, createFamilyService, familyRoute } from "@/modules/family";
import {
  createFamilyRequestRepo,
  createFamilyRequestService,
  familyRequestRoute,
} from "@/modules/family-request";
import { createInviteRepo, createInviteService, inviteRoute } from "@/modules/invite";
import { createMemberRepo, createMemberService, memberRoute } from "@/modules/member";
import { createPetRepo, createPetService, petRoute } from "@/modules/pet";
import {
  createPhotoStorageRepo,
  createPhotoStorageService,
  photoStorageRoute,
} from "@/modules/photo-storage";
import { createPlanRepo, createPlanService, planRoute } from "@/modules/plan";
import {
  createDispatchRepo,
  createReminderRepo,
  createReminderService,
  createSourceRepo,
  reminderRoute,
} from "@/modules/reminder";
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

const maintenanceHourUtc = 3;

// Housekeeping rides the same per-minute cron once a day, at 03:00 UTC.
function isMaintenanceMinute(now: number): boolean {
  const moment = new Date(now);

  return moment.getUTCHours() === maintenanceHourUtc && moment.getUTCMinutes() === 0;
}

function allowedOrigin(origin: string, env: Env): string | null {
  return env.ALLOWED_ORIGINS.split(",").includes(origin) ? origin : null;
}

type Shared = { memberships: MembershipRepo; bot: BotApi; clock: Clock };

// The services of what a Family keeps: its Pets, journal, Plans, Events and Reminders.
function familyRecordServices(db: Db, shared: Shared) {
  const { clock } = shared;
  const reminders = createReminderService({
    reminders: createReminderRepo(db),
    dispatch: createDispatchRepo(db),
    sources: createSourceRepo(db),
    ...shared,
  });

  return {
    reminders,
    careEntries: createCareEntryService({
      entries: createCareEntryRepo(db),
      clock,
      schedule: reminders,
    }),
    events: createEventService({ events: createEventRepo(db), clock, schedule: reminders }),
    pets: createPetService({ pets: createPetRepo(db), clock, schedule: reminders }),
    plans: createPlanService({ plans: createPlanRepo(db), ...shared }),
    members: createMemberService({ members: createMemberRepo(db), clock, schedule: reminders }),
  };
}

function servicesFor(env: Env, { clock, createBotApi }: WorkerDependencies): AppServices {
  const db = createDb(env.DB);
  const bot = createBotApi(env.BOT_TOKEN);
  const memberships = createMembershipRepo(db);
  const shared = { memberships, bot, clock };
  const records = familyRecordServices(db, shared);
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
    ...records,
    families: createFamilyService({ families: createFamilyRepo(db), bot, clock }),
    familyRequests,
    invites: createInviteService({
      invites: createInviteRepo(db),
      memberships,
      familyRequests,
      bot,
      clock,
    }),
    photoStorage: createPhotoStorageService({ storage: createPhotoStorageRepo(db), ...shared }),
  };
}

function exposeInfrastructure(context: Context<AppEnv>, services: AppServices): void {
  context.set("db", services.db);
  context.set("clock", services.clock);
  context.set("bot", services.bot);
  context.set("auth", services.auth);
}

function createApp(dependencies: WorkerDependencies) {
  return new Hono<AppEnv>()
    .use("/api/*", cors({ origin: (origin, context) => allowedOrigin(origin, context.env) }))
    .use(async (context, next) => {
      const services = servicesFor(context.env, dependencies);

      exposeInfrastructure(context, services);
      context.set("careEntries", services.careEntries);
      context.set("events", services.events);
      context.set("families", services.families);
      context.set("familyRequests", services.familyRequests);
      context.set("invites", services.invites);
      context.set("members", services.members);
      context.set("pets", services.pets);
      context.set("photoStorage", services.photoStorage);
      context.set("plans", services.plans);
      context.set("reminders", services.reminders);
      await next();
    })
    .route("/", healthRoute)
    .route("/", webhookRoute)
    .route("/", sessionRoute)
    .route("/", familyRequestRoute)
    .route("/", inviteRoute)
    .route("/", memberRoute)
    .route("/", familyRoute)
    .route("/", petRoute)
    .route("/", planRoute)
    .route("/", photoStorageRoute)
    .route("/", careEntryRoute)
    .route("/", eventRoute)
    .route("/", reminderRoute);
}

async function runScheduled(env: Env, dependencies: WorkerDependencies): Promise<void> {
  const services = servicesFor(env, dependencies);

  await services.reminders.deliverDue();

  if (isMaintenanceMinute(dependencies.clock.now())) {
    await services.invites.sweep();
    await services.familyRequests.sweep();
  }
}

export function createWorker(dependencies: WorkerDependencies): Worker {
  return {
    fetch: createApp(dependencies).fetch,
    scheduled: async (_controller, env) => runScheduled(env, dependencies),
  };
}
