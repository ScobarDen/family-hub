import { expect, test } from "vite-plus/test";

import { startWorker } from "./worker-harness.ts";

test("cron tick with nothing due sends no bot messages", async () => {
  const worker = startWorker();

  await worker.tick();

  expect(worker.bot.sentMessages()).toEqual([]);
});
