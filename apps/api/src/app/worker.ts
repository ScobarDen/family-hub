import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

import { createAuthService, createMembershipRepo, type MembershipRepo } from "@/common/auth";
import type { Clock } from "@/common/clock";
import { createDb, type Db } from "@/common/db";
import { createPhotoLinks, type PhotoLinks } from "@/common/photo-link";
import type { BotApi } from "@/common/telegram";
import { albumRoute, createAlbumRepo, createAlbumService } from "@/modules/album";
import {
  careEntryRoute,
  createCareEntryRepo,
  createCareEntryService,
  type CareEntryService,
} from "@/modules/care-entry";
import { createCommandRepo, createCommandService } from "@/modules/command";
import { createEventRepo, createEventService, eventRoute } from "@/modules/event";
import { createFamilyRepo, createFamilyService, familyRoute } from "@/modules/family";
import {
  createFamilyRequestRepo,
  createFamilyRequestService,
  familyRequestRoute,
} from "@/modules/family-request";
import { createFeedRepo, createFeedService, feedRoute, type FeedService } from "@/modules/feed";
import { createGoalRepo, createGoalService, goalRoute } from "@/modules/goal";
import { createInviteRepo, createInviteService, inviteRoute } from "@/modules/invite";
import { createMemberRepo, createMemberService, memberRoute } from "@/modules/member";
import { createPetRepo, createPetService, petRoute } from "@/modules/pet";
import {
  createPhotoRepo,
  createPhotoService,
  createTelegramPhotoFiles,
  photoRoute,
} from "@/modules/photo";
import {
  createPhotoStorageRepo,
  createPhotoStorageService,
  photoStorageRoute,
} from "@/modules/photo-storage";
import { createPlanRepo, createPlanService, planRoute, type PlanService } from "@/modules/plan";
import { createRecipeRepo, createRecipeService, recipeRoute } from "@/modules/recipe";
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

type Records = Shared & { links: PhotoLinks };

// A photo added to a Pet's automatic Album lands in a Care Entry «Заметка» of that Pet.
function albumServiceOf(
  db: Db,
  { careEntries, links, clock }: { careEntries: CareEntryService; links: PhotoLinks; clock: Clock },
) {
  return createAlbumService({
    albums: createAlbumRepo(db),
    links,
    clock,
    petNotes: {
      addNote: async (membership, { petId, photoIds }) => {
        await careEntries.create(membership, petId, {
          occurredAt: clock.now(),
          note: null,
          details: { kind: "note" },
          photoIds,
        });
      },
    },
  });
}

// A Plan's Reminder completes the Plan from the bot, and the Plan reschedules its Reminders;
// the morning digest reads the Member's Feed.
function reminderServiceOf(
  db: Db,
  { shared, feed, plans }: { shared: Shared; feed: FeedService; plans: () => PlanService },
) {
  return createReminderService({
    plans: { completeById: async (membership, planId) => plans().completeById(membership, planId) },
    digests: {
      contentOf: async (memberId) => {
        const membership = await shared.memberships.findByMemberId(memberId);

        return membership && feed.digestOf(membership);
      },
    },
    reminders: createReminderRepo(db),
    dispatch: createDispatchRepo(db),
    sources: createSourceRepo(db),
    ...shared,
  });
}

// The services of what a Family keeps: its Pets, journal, Plans, Events and Reminders.
function familyRecordServices(db: Db, { links, ...shared }: Records) {
  const { clock } = shared;
  const feed = createFeedService({ feed: createFeedRepo(db), clock, links });
  const reminders = reminderServiceOf(db, { shared, feed, plans: () => plans });
  const plans = createPlanService({
    plans: createPlanRepo(db),
    ...shared,
    schedule: reminders,
    links,
  });
  const careEntries = createCareEntryService({
    entries: createCareEntryRepo(db),
    clock,
    schedule: reminders,
    links,
  });

  return {
    reminders,
    plans,
    careEntries,
    albums: albumServiceOf(db, { careEntries, links, clock }),
    events: createEventService({ events: createEventRepo(db), clock, schedule: reminders }),
    pets: createPetService({ pets: createPetRepo(db), clock, schedule: reminders, links }),
    members: createMemberService({ members: createMemberRepo(db), clock, schedule: reminders }),
    feed,
    goals: createGoalService({ goals: createGoalRepo(db), clock }),
    recipes: createRecipeService({ recipes: createRecipeRepo(db), links, clock }),
    photos: createPhotoService({
      photos: createPhotoRepo(db),
      files: createTelegramPhotoFiles(shared.bot),
      links,
      clock,
    }),
  };
}

const defaultCommandsPerFamilyDay = 30;

// Workers AI's typed catalogue knows each model by name; ours come from configuration.
function workersAiModel(ai: Ai) {
  const run: (model: string, input: Record<string, unknown>) => Promise<unknown> = ai.run.bind(ai);

  return { run };
}

function commandServiceOf(
  env: Env,
  { db, shared, reminders }: { db: Db; shared: Shared; reminders: AppServices["reminders"] },
) {
  const perDay = Number(env.AI_COMMANDS_PER_FAMILY_DAY);

  return createCommandService({
    drafts: createCommandRepo(db),
    ...shared,
    model: workersAiModel(env.AI),
    models: { primary: env.AI_COMMAND_MODEL, fallback: env.AI_COMMAND_MODEL_FALLBACK },
    speechModel: env.AI_SPEECH_MODEL,
    commandsPerFamilyDay:
      Number.isFinite(perDay) && perDay > 0 ? perDay : defaultCommandsPerFamilyDay,
    reminders,
  });
}

function authServiceOf(
  env: Env,
  { memberships, clock }: { memberships: MembershipRepo; clock: Clock },
) {
  return createAuthService({
    memberships,
    clock,
    botToken: env.BOT_TOKEN,
    jwtSecret: env.JWT_SECRET,
  });
}

function servicesFor(env: Env, { clock, createBotApi }: WorkerDependencies): AppServices {
  const db = createDb(env.DB);
  const bot = createBotApi(env.BOT_TOKEN);
  const memberships = createMembershipRepo(db);
  const shared = { memberships, bot, clock };
  const records = familyRecordServices(db, {
    ...shared,
    links: createPhotoLinks({ secret: env.JWT_SECRET, clock }),
  });
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
    auth: authServiceOf(env, { memberships, clock }),
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
    commands: commandServiceOf(env, { db, shared, reminders: records.reminders }),
  };
}

function exposeInfrastructure(context: Context<AppEnv>, services: AppServices): void {
  context.set("db", services.db);
  context.set("clock", services.clock);
  context.set("bot", services.bot);
  context.set("auth", services.auth);
  context.set("commands", services.commands);
}

function exposeRecords(context: Context<AppEnv>, services: AppServices): void {
  context.set("careEntries", services.careEntries);
  context.set("events", services.events);
  context.set("families", services.families);
  context.set("familyRequests", services.familyRequests);
  context.set("invites", services.invites);
  context.set("members", services.members);
  context.set("pets", services.pets);
  context.set("photoStorage", services.photoStorage);
  context.set("plans", services.plans);
  context.set("feed", services.feed);
  context.set("goals", services.goals);
  context.set("photos", services.photos);
  context.set("albums", services.albums);
  context.set("recipes", services.recipes);
  context.set("reminders", services.reminders);
}

function createApp(dependencies: WorkerDependencies) {
  return new Hono<AppEnv>()
    .use("/api/*", cors({ origin: (origin, context) => allowedOrigin(origin, context.env) }))
    .use(async (context, next) => {
      const services = servicesFor(context.env, dependencies);

      exposeInfrastructure(context, services);
      exposeRecords(context, services);
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
    .route("/", feedRoute)
    .route("/", goalRoute)
    .route("/", photoRoute)
    .route("/", albumRoute)
    .route("/", recipeRoute)
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
    await services.commands.sweep();
  }
}

export function createWorker(dependencies: WorkerDependencies): Worker {
  return {
    fetch: createApp(dependencies).fetch,
    scheduled: async (_controller, env) => runScheduled(env, dependencies),
  };
}
