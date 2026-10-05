import { expect, test } from "vite-plus/test";

import { startWorker } from "./worker-harness.ts";

test("health check reports ok once the database answers", async () => {
  const worker = startWorker();

  const response = await worker.request("/api/health");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
