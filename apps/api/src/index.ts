import { systemClock } from "@/common/clock";
import { FamilyLive } from "@/common/live";
import { createHttpBotApi } from "@/common/telegram";

import { createWorker } from "./app/worker.ts";

export default createWorker({ clock: systemClock, createBotApi: createHttpBotApi });

export { FamilyLive };
