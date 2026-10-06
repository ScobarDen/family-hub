import { join } from "node:path";

import { expect, test } from "vite-plus/test";
import { unstable_readConfig } from "wrangler";

// Cloudflare allows 5 cron triggers per account; every job shares one tick.
test("production runs exactly one per-minute cron trigger", () => {
  const config = unstable_readConfig({ config: join(import.meta.dirname, "..", "wrangler.jsonc") });

  expect(config.triggers.crons).toEqual(["* * * * *"]);
});
