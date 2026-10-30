import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

import type { Clock } from "@/common/clock.lib.ts";
import {
  albumRoute,
  createAlbumFeed,
  createAlbumRepo,
  createAlbumService,
  createAlbumTile,
} from "@/modules/album";
import {
  createAuthService,
  createDeviceRepo,
  createMembershipRepo,
  sessionRoute,
  type MembershipRepo,
} from "@/modules/auth";
import {
  careEntryRoute,
  createCareFeed,
  createCareEntryRepo,
  createCareEntryService,
  createPetTile,
  type CareEntryService,
} from "@/modules/care-entry";
import { commandRoute, createCommandRepo, createCommandService } from "@/modules/command";
import { createDb, type Db } from "@/modules/db";
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
import { liveRoute, signalWrites } from "@/modules/live";
import { createMemberRepo, createMemberService, memberRoute } from "@/modules/member";
import { createPetFeed, createPetRepo, createPetService, petRoute } from "@/modules/pet";
import {
  createPhotoLinks,
  type PhotoLinks,
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
  createPressTokens,
  createPushRepo,
  createPushService,
  pushRoute,
  type PushService,
  type PushTransport,
  type Vapid,
} from "@/modules/push";
import {
  createRecipeRepo,
  createRecipeService,
  createRecipeTile,
  recipeRoute,
} from "@/modules/recipe";
import {
  createDispatchRepo,
  createReminderService,
  createSourceRepo,
  reminderRoute,
  type ReminderService,
} from "@/modules/reminder";
import {
  createTaskFeed,
  createTaskRepo,
  createTaskService,
  createTaskTile,
  taskRoute,
  type TaskRepo,
  type TaskService,
} from "@/modules/task";
import { createMiniAppLinks, type MiniAppLinks, type BotApi } from "@/modules/telegram";
import { createTodayService, todayRoute } from "@/modules/today";

import type { AppEnv, AppServices } from "./app.types.ts";
import { healthRoute } from "./health.route.ts";
import { webhookRoute } from "./webhook.route.ts";

type WorkerDependencies = {
  clock: Clock;
  createBotApi: (token: string) => BotApi;
  createPushTransport: (vapid: Vapid) => PushTransport;
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

type Shared = {
  memberships: MembershipRepo;
  bot: BotApi;
  appLinks: MiniAppLinks;
  clock: Clock;
  push: PushService;
};

type Records = Shared & { links: PhotoLinks };

// A photo added to a Pet's automatic Album lands in a Care Entry «Заметка» of that Pet.
function albumServiceOf(
  db: Db,
  {
    careEntries,
    links,
    shared,
  }: { careEntries: CareEntryService; links: PhotoLinks; shared: Shared },
) {
  const { clock } = shared;

  return createAlbumService({
    albums: createAlbumRepo(db),
    links,
    clock,
    bot: shared.bot,
    appLinks: shared.appLinks,
    petNotes: {
      addNote: async (membership, { petId, photoIds }) => {
        await careEntries.create(membership, petId, {
          occurredAt: clock.now(),
          repeatOn: null,
          note: null,
          details: { kind: "note" },
          photoIds,
        });
      },
    },
  });
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

// The hub reads the same Tasks for its lists and for its tile, once.
function sharedTasksOf(db: Db): TaskRepo {
  const tasks = createTaskRepo(db);

  return { ...tasks, listVisible: readOnce(tasks.listVisible) };
}

function feedServiceOf(
  db: Db,
  {
    links,
    clock,
    tasks = createTaskRepo(db),
  }: { links: PhotoLinks; clock: Clock; tasks?: TaskRepo },
) {
  const taskFeed = createTaskFeed({ tasks, links });

  return createFeedService({
    activity: [
      createCareFeed({ entries: createCareEntryRepo(db), links }),
      taskFeed,
      createGoalFeed({ goals: createGoalRepo(db) }),
      createAlbumFeed({ albums: createAlbumRepo(db), links }),
      createFamilyFeed({ families: createFamilyRepo(db) }),
    ],
    upcoming: [taskFeed, createPetFeed({ pets: createPetRepo(db), links })],
    clock,
  });
}

// Each section's tile comes from the module that owns it; the hub only merges them.
function todayServiceOf(db: Db, { links, clock }: { links: PhotoLinks; clock: Clock }) {
  const tasks = sharedTasksOf(db);

  return createTodayService({
    feed: feedServiceOf(db, { links, clock, tasks }),
    clock,
    tiles: {
      tasks: createTaskTile({ tasks, links }),
      pet: createPetTile({ entries: createCareEntryRepo(db), links }),
      goals: createGoalTile({ goals: createGoalRepo(db) }),
      albums: createAlbumTile({ albums: createAlbumRepo(db) }),
      recipes: createRecipeTile({ recipes: createRecipeRepo(db) }),
    },
  });
}

// «Готово» in the bot completes a Task Occurrence, and the Task reschedules its Reminders; the
// morning digest reads the Member's Feed.
function reminderServiceOf(
  db: Db,
  { shared, feed, tasks }: { shared: Shared; feed: FeedService; tasks: () => TaskService },
) {
  const taskRepo = createTaskRepo(db);

  return createReminderService({
    tasks: {
      findTree: taskRepo.findTree,
      complete: async (membership, target) => tasks().complete(membership, target),
    },
    digests: {
      contentOf: async (memberId) => {
        const membership = await shared.memberships.findByMemberId(memberId);

        return membership && feed.digestOf(membership);
      },
    },
    dispatch: createDispatchRepo(db),
    sources: createSourceRepo(db),
    ...shared,
  });
}

// The services of what a Family keeps: its Pets, journal and Tasks.
function familyRecordServices(db: Db, { links, ...shared }: Records) {
  const { clock } = shared;
  const feed = feedServiceOf(db, { links, clock });
  const reminders = reminderServiceOf(db, { shared, feed, tasks: () => tasks });
  const tasks = createTaskService({
    tasks: createTaskRepo(db),
    ...shared,
    schedule: reminders,
    links,
  });
  const careEntries = createCareEntryService({
    entries: createCareEntryRepo(db),
    clock,
    followUps: tasks,
    links,
  });

  return {
    reminders,
    tasks,
    careEntries,
    albums: albumServiceOf(db, { careEntries, links, shared }),
    pets: createPetService({ pets: createPetRepo(db), clock, schedule: reminders, links }),
    members: createMemberService({ members: createMemberRepo(db), clock, schedule: reminders }),
    feed,
    today: todayServiceOf(db, { links, clock }),
    goals: createGoalService({ goals: createGoalRepo(db), clock }),
    recipes: createRecipeService({ recipes: createRecipeRepo(db), links, ...shared }),
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
    records: Pick<AppServices, "tasks" | "careEntries">;
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
    tasks: records.tasks,
    careEntries: records.careEntries,
  });
}

function authServiceOf(
  db: Db,
  env: Env,
  { memberships, clock }: { memberships: MembershipRepo; clock: Clock },
) {
  return createAuthService({
    memberships,
    devices: createDeviceRepo(db),
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

function pushServiceOf(
  db: Db,
  env: Env,
  { clock, createPushTransport }: Pick<WorkerDependencies, "clock" | "createPushTransport">,
) {
  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
  const devices = createDeviceRepo(db);

  return createPushService({
    subscriptions: createPushRepo(db),
    devices: { isLive: devices.isLive },
    transport: createPushTransport(vapid),
    pressTokens: createPressTokens(vapid.privateKey),
    clock,
    publicKey: vapid.publicKey,
  });
}

function servicesFor(env: Env, dependencies: WorkerDependencies): AppServices {
  const { clock, createBotApi } = dependencies;
  const db = createDb(env.DB);
  const bot = createBotApi(env.BOT_TOKEN);
  const memberships = createMembershipRepo(db);
  const push = pushServiceOf(db, env, dependencies);
  const shared = { memberships, bot, appLinks: createMiniAppLinks(bot), clock, push };
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
    auth: authServiceOf(db, env, { memberships, clock }),
    push,
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
    .use("/api/*", signalWrites)
    .route("/", healthRoute)
    .route("/", liveRoute)
    .route("/", webhookRoute)
    .route("/", sessionRoute)
    .route("/", pushRoute)
    .route("/", reminderRoute)
    .route("/", familyRequestRoute)
    .route("/", inviteRoute)
    .route("/", memberRoute)
    .route("/", familyRoute)
    .route("/", petRoute)
    .route("/", taskRoute)
    .route("/", feedRoute)
    .route("/", todayRoute)
    .route("/", goalRoute)
    .route("/", photoRoute)
    .route("/", albumRoute)
    .route("/", recipeRoute)
    .route("/", photoStorageRoute)
    .route("/", careEntryRoute)
    .route("/", commandRoute);
}

async function runScheduled(env: Env, dependencies: WorkerDependencies): Promise<void> {
  const services = servicesFor(env, dependencies);

  await services.reminders.deliverDue();

  if (isMaintenanceMinute(dependencies.clock.now())) {
    await services.invites.sweep();
    await services.familyRequests.sweep();
    await services.commands.sweep();
    await services.auth.sweepDevices();
  }
}

export function createWorker(dependencies: WorkerDependencies): Worker {
  return {
    fetch: createApp(dependencies).fetch,
    scheduled: async (_controller, env) => runScheduled(env, dependencies),
  };
}
