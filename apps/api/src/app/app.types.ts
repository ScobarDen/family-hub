import type { AuthService } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";

export type AppServices = {
  db: Db;
  clock: Clock;
  bot: BotApi;
  auth: AuthService;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppServices;
};
