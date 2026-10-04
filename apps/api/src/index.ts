import { systemClock } from "@/common/clock";
import { createHttpBotApi } from "@/common/telegram";
import { createWorker } from "./app/worker.ts";

export default createWorker({ clock: systemClock, createBotApi: createHttpBotApi });
