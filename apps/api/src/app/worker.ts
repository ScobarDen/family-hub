import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

import {
  createAuthService,
  createMembershipRepo,
  sessionRoute,
  type MembershipRepo,
} from "@/common/auth";
import type { Clock } from "@/common/clock";
import { createDb, type Db } from "@/common/db";
import { createMiniAppLinks, type MiniAppLinks } from "@/common/mini-app-link";
import { createPhotoLinks, type PhotoLinks } from "@/common/photo-link";
import type { BotApi } from "@/common/telegram";
import {
  albumRoute,
  createAlbumFeed,
  createAlbumRepo,
  createAlbumService,
  createAlbumTile,
} from "@/modules/album";
import {
  careEntryRoute,
  createCareFeed,
  createCareEntryRepo,
  createCareEntryService,
  createPetTile,
  type CareEntryRepo,
  type CareEntryService,
} from "@/modules/care-entry";
import { commandRoute, createCommandRepo, createCommandService } from "@/modules/command";
import {
  createEventFeed,
  createEventRepo,
  createEventService,
  createEventTile,
  eventRoute,
  type EventRepo,
} from "@/modules/event";
import {
  createFamilyFeed,
  createFamilyRepo,
  createFamilyService,
  familyRoute,
} from "@/modules/family";
import {
  createFamilyRequestRepo,
  createFamilyRequestService,
  familyRequestRoute,
  type FamilyRequestService,
} from "@/modules/family-request";
import { createFeedService, feedRoute, type FeedService } from "@/modules/feed";
import {
  createGoalFeed,
  createGoalRepo,
  createGoalService,
  createGoalTile,
  goalRoute,
} from "@/modules/goal";
import { createInviteRepo, createInviteService, inviteRoute } from "@/modules/invite";
import { createMemberRepo, createMemberService, memberRoute } from "@/modules/member";
import { createPetFeed, createPetRepo, createPetService, petRoute } from "@/modules/pet";
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
import {
  createPlanFeed,
  createPlanRepo,
  createPlanService,
  createPlanTile,
  planRoute,
  type PlanRepo,
  type PlanService,
} from "@/modules/plan";
import {
  createRecipeFeed,
  createRecipeRepo,
  createRecipeService,
  createRecipeTile,
  recipeRoute,
} from "@/modules/recipe";
import {
  createDispatchRepo,
  createReminderFeed,
  createReminderRepo,
  createReminderService,
  createSourceRepo,
  reminderRoute,
  type ReminderService,
} from "@/modules/reminder";
import { createTodayService, todayRoute } from "@/modules/today";

import type { AppEnv, AppServices } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

type WorkerDependencies = {
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

type Shared = { memberships: MembershipRepo; bot: BotApi; appLinks: MiniAppLinks; clock: Clock };

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

type FeedReads = {
  plans: PlanRepo;
  events: EventRepo;
  entries: CareEntryRepo;
};

function readsOf(db: Db): FeedReads {
  return {
    plans: createPlanRepo(db),
    events: createEventRepo(db),
    entries: createCareEntryRepo(db),
  };
}

function readOnce<Rows>(read: (...keys: string[]) => Promise<Rows>) {
  const reads = new Map<string, Promise<Rows>>();

  return async (...keys: string[]): Promise<Rows> => {
    const key = keys.join(":");
    const held = reads.get(key) ?? read(...keys);

    reads.set(key, held);

    return held;
  };
}

// The hub reads the same Plans, Events and Due Dates for its lists and for its tiles, once each.
function sharedReadsOf(db: Db): FeedReads {
  const { plans, events, entries } = readsOf(db);

  return {
    plans: { ...plans, listVisible: readOnce(plans.listVisible) },
    events: { ...events, listVisible: readOnce(events.listVisible) },
    entries: {
      ...entries,
      petsOf: readOnce(entries.petsOf),
      allDueCandidates: readOnce(entries.allDueCandidates),
    },
  };
}

function feedServiceOf(
  db: Db,
  { links, clock, reads = readsOf(db) }: { links: PhotoLinks; clock: Clock; reads?: FeedReads },
) {
  const care = createCareFeed({ entries: reads.entries, links });
  const plans = createPlanFeed({ plans: reads.plans });

  return createFeedService({
    activity: [
      care,
      plans,
      createGoalFeed({ goals: createGoalRepo(db) }),
      createRecipeFeed({ recipes: createRecipeRepo(db), links }),
      createAlbumFeed({ albums: createAlbumRepo(db), links }),
      createFamilyFeed({ families: createFamilyRepo(db) }),
    ],
    upcoming: [
      care,
      plans,
      createEventFeed({ events: reads.events }),
      createReminderFeed({ reminders: createReminderRepo(db) }),
      createPetFeed({ pets: createPetRepo(db) }),
    ],
    clock,
  });
}

// Each section's tile comes from the module that owns it; the hub only merges them.
function todayServiceOf(db: Db, { links, clock }: { links: PhotoLinks; clock: Clock }) {
  const reads = sharedReadsOf(db);

  return createTodayService({
    feed: feedServiceOf(db, { links, clock, reads }),
    clock,
    tiles: {
      plans: createPlanTile({ plans: reads.plans }),
      calendar: createEventTile({ events: reads.events }),
      pet: createPetTile({ entries: reads.entries }),
      goals: createGoalTile({ goals: createGoalRepo(db) }),
      albums: createAlbumTile({ albums: createAlbumRepo(db) }),
      recipes: createRecipeTile({ recipes: createRecipeRepo(db) }),
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
  const feed = feedServiceOf(db, { links, clock });
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
    today: todayServiceOf(db, { links, clock }),
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
  {
    db,
    shared,
    records,
  }: {
    db: Db;
    shared: Shared;
    records: Pick<AppServices, "reminders" | "events" | "careEntries">;
  },
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
    reminders: records.reminders,
    events: records.events,
    careEntries: records.careEntries,
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

function membershipServicesOf(
  db: Db,
  {
    shared,
    familyRequests,
    schedule,
  }: { shared: Shared; familyRequests: FamilyRequestService; schedule: ReminderService },
) {
  return {
    families: createFamilyService({ families: createFamilyRepo(db), schedule, ...shared }),
    invites: createInviteService({
      invites: createInviteRepo(db),
      familyRequests,
      schedule,
      ...shared,
    }),
  };
}

function servicesFor(env: Env, { clock, createBotApi }: WorkerDependencies): AppServices {
  const db = createDb(env.DB);
  const bot = createBotApi(env.BOT_TOKEN);
  const memberships = createMembershipRepo(db);
  const shared = { memberships, bot, appLinks: createMiniAppLinks(bot), clock };
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
    auth: authServiceOf(env, { memberships, clock }),
    ...records,
    ...membershipServicesOf(db, { shared, familyRequests, schedule: records.reminders }),
    familyRequests,
    photoStorage: createPhotoStorageService({ storage: createPhotoStorageRepo(db), ...shared }),
    commands: commandServiceOf(env, { db, shared, records }),
  };
}

function isServiceName(services: AppServices, key: string): key is keyof AppServices {
  return key in services;
}

function expose(context: Context<AppEnv>, services: AppServices): void {
  for (const key of Object.keys(services).filter((name) => isServiceName(services, name))) {
    context.set(key, services[key]);
  }
}

function createApp(dependencies: WorkerDependencies) {
  return new Hono<AppEnv>()
    .use("/api/*", cors({ origin: (origin, context) => allowedOrigin(origin, context.env) }))
    .use(async (context, next) => {
      const services = servicesFor(context.env, dependencies);

      expose(context, services);
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
    .route("/", todayRoute)
    .route("/", goalRoute)
    .route("/", photoRoute)
    .route("/", albumRoute)
    .route("/", recipeRoute)
    .route("/", photoStorageRoute)
    .route("/", careEntryRoute)
    .route("/", eventRoute)
    .route("/", reminderRoute)
    .route("/", commandRoute);
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
