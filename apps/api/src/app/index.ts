import { systemClock } from "@/common/clock.lib.ts";
import { FamilyLive } from "@/modules/live";
import { createHttpBotApi } from "@/modules/telegram";

import { createWorker } from "./worker.ts";

export default createWorker({ clock: systemClock, createBotApi: createHttpBotApi });

export { FamilyLive };
