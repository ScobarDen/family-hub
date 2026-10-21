import type { AuthService } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { AlbumService } from "@/modules/album";
import type { CareEntryService } from "@/modules/care-entry";
import type { CommandService } from "@/modules/command";
import type { EventService } from "@/modules/event";
import type { FamilyService } from "@/modules/family";
import type { FamilyRequestService } from "@/modules/family-request";
import type { FeedService } from "@/modules/feed";
import type { GoalService } from "@/modules/goal";
import type { InviteService } from "@/modules/invite";
import type { MemberService } from "@/modules/member";
import type { PetService } from "@/modules/pet";
import type { PhotoService } from "@/modules/photo";
import type { PhotoStorageService } from "@/modules/photo-storage";
import type { PlanService } from "@/modules/plan";
import type { RecipeService } from "@/modules/recipe";
import type { ReminderService } from "@/modules/reminder";

export type AppServices = {
  db: Db;
  clock: Clock;
  bot: BotApi;
  auth: AuthService;
  albums: AlbumService;
  careEntries: CareEntryService;
  commands: CommandService;
  events: EventService;
  families: FamilyService;
  feed: FeedService;
  goals: GoalService;
  photos: PhotoService;
  familyRequests: FamilyRequestService;
  invites: InviteService;
  members: MemberService;
  pets: PetService;
  photoStorage: PhotoStorageService;
  plans: PlanService;
  recipes: RecipeService;
  reminders: ReminderService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
