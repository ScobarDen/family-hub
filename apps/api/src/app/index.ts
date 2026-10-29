import { systemClock } from "@/common/clock.lib.ts";
import { FamilyLive } from "@/modules/live";
import { createWebPushTransport } from "@/modules/push";
import { createHttpBotApi } from "@/modules/telegram";

import { createWorker } from "./worker.ts";

export default createWorker({
  clock: systemClock,
  createBotApi: createHttpBotApi,
  createPushTransport: (vapid) => createWebPushTransport({ vapid, clock: systemClock }),
});

export { FamilyLive };
