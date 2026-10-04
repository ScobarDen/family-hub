import type { Clock } from "@/common/clock";
import type { Db } from "@/common/db";
import type { BotApi } from "@/common/telegram";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    clock: Clock;
    bot: BotApi;
  };
};
