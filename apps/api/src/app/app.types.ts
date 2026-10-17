import type { AuthService } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";
import type { FamilyRequestService } from "@/modules/family-request";

export type AppServices = {
  db: Db;
  clock: Clock;
  bot: BotApi;
  auth: AuthService;
  familyRequests: FamilyRequestService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
