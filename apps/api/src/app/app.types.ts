import type { AuthService } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { CareEntryService } from "@/modules/care-entry";
import type { EventService } from "@/modules/event";
import type { FamilyService } from "@/modules/family";
import type { FamilyRequestService } from "@/modules/family-request";
import type { InviteService } from "@/modules/invite";
import type { MemberService } from "@/modules/member";
import type { PetService } from "@/modules/pet";
import type { PhotoStorageService } from "@/modules/photo-storage";
import type { PlanService } from "@/modules/plan";
import type { ReminderService } from "@/modules/reminder";

export type AppServices = {
  db: Db;
  clock: Clock;
  bot: BotApi;
  auth: AuthService;
  careEntries: CareEntryService;
  events: EventService;
  families: FamilyService;
  familyRequests: FamilyRequestService;
  invites: InviteService;
  members: MemberService;
  pets: PetService;
  photoStorage: PhotoStorageService;
  plans: PlanService;
  reminders: ReminderService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
