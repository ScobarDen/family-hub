import type { Update } from "@grammyjs/types";
import { expect, test } from "vite-plus/test";
import { startWorker } from "./worker-harness.ts";

const update: Update = { update_id: 1 };

test("bot webhook accepts updates signed with the webhook secret", async () => {
  const worker = startWorker();

  const response = await worker.webhook(update);

  expect(response.status).toBe(200);
});

test("bot webhook rejects updates with a wrong secret", async () => {
  const worker = startWorker();

  const response = await worker.webhook(update, { secret: "forged" });

  expect(response.status).toBe(401);
});
