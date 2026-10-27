import type { AuthService } from "@/common/auth";
import type { Db } from "@/common/db";
import type { AlbumService } from "@/modules/album";
import type { CareEntryService } from "@/modules/care-entry";
import type { CommandService } from "@/modules/command";
import type { FamilyService } from "@/modules/family";
import type { FamilyRequestService } from "@/modules/family-request";
import type { FeedService } from "@/modules/feed";
import type { GoalService } from "@/modules/goal";
import type { InviteService } from "@/modules/invite";
import type { MemberService } from "@/modules/member";
import type { PetService } from "@/modules/pet";
import type { PhotoService } from "@/modules/photo";
import type { PhotoStorageService } from "@/modules/photo-storage";
import type { RecipeService } from "@/modules/recipe";
import type { ReminderService } from "@/modules/reminder";
import type { TaskService } from "@/modules/task";
import type { TodayService } from "@/modules/today";

export type AppServices = {
  db: Db;
  auth: AuthService;
  albums: AlbumService;
  careEntries: CareEntryService;
  commands: CommandService;
  families: FamilyService;
  feed: FeedService;
  goals: GoalService;
  photos: PhotoService;
  familyRequests: FamilyRequestService;
  invites: InviteService;
  members: MemberService;
  pets: PetService;
  photoStorage: PhotoStorageService;
  recipes: RecipeService;
  reminders: ReminderService;
  tasks: TaskService;
  today: TodayService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
