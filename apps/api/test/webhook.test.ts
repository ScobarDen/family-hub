import type { Update } from "@grammyjs/types";
import { expect, test } from "vite-plus/test";

import { startWorker } from "./worker-harness.ts";

const update: Update = { update_id: 1 };

test("bot webhook accepts updates signed with the webhook secret", async () => {
  const worker = startWorker();

  const response = await worker.webhook(update);

  expect(response.status).toBe(200);
});

test("bot webhook drops an unreadable update instead of having Telegram retry it", async () => {
  const worker = startWorker();

  const response = await worker.request("/bot/webhook", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": worker.env.WEBHOOK_SECRET },
    body: "not json",
  });

  expect(response.status).toBe(200);
});

test("bot webhook rejects updates with a wrong secret", async () => {
  const worker = startWorker();

  const response = await worker.webhook(update, { secret: "forged" });

  expect(response.status).toBe(401);
});

test("bot webhook rejects updates without the secret header", async () => {
  const worker = startWorker();

  const response = await worker.request("/bot/webhook", {
    method: "POST",
    body: JSON.stringify(update),
  });

  expect(response.status).toBe(401);
});

test("bot webhook rejects every update while no secret is configured", async () => {
  const worker = startWorker();

  worker.env.WEBHOOK_SECRET = "";

  const response = await worker.webhook(update, { secret: "" });

  expect(response.status).toBe(401);
});
