import type { Clock } from "@/common/clock.lib.ts";
import { httpStatus } from "@/common/errors.lib.ts";

import { encryptPayload, generateSenderKeys } from "./lib/encryption.lib.ts";
import { vapidAuthorization, type Vapid } from "./lib/vapid.lib.ts";
import type { PushOutcome, PushTransport } from "./push.types.ts";

// A Reminder older than a day is not worth showing.
const timeToLiveSeconds = 86_400;
// The cron tick delivers rows one after another under a 60-second lock, so a slow push service is cut off.
const pushTimeoutMs = 10_000;

function outcomeOf({ ok, status }: Response): PushOutcome {
  if (ok) {
    return "accepted";
  }

  if (status === httpStatus.notFound || status === httpStatus.gone) {
    return "gone";
  }

  console.error("Push service refused", { status });

  return "refused";
}

export function createWebPushTransport({
  vapid,
  clock,
}: {
  vapid: Vapid;
  clock: Clock;
}): PushTransport {
  return {
    async send(target, payload) {
      const body = await encryptPayload(payload, target, { sender: await generateSenderKeys() });
      const response = await fetch(target.endpoint, {
        method: "POST",
        headers: {
          authorization: await vapidAuthorization(vapid, {
            endpoint: target.endpoint,
            now: clock.now(),
          }),
          "content-encoding": "aes128gcm",
          "content-type": "application/octet-stream",
          ttl: String(timeToLiveSeconds),
          urgency: "high",
        },
        body,
        signal: AbortSignal.timeout(pushTimeoutMs),
      });

      return outcomeOf(response);
    },
  };
}
