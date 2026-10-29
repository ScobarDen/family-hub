import { pushMessage, type PushMessage } from "@family-hub/contract";

import type { PushOutcome, PushTransport } from "@/modules/push";

type Push = { endpoint: string; message: PushMessage };

// Records what reached each push service, which accepts it unless told otherwise for an endpoint.
export function createFakePush() {
  const pushes: Push[] = [];
  const outcomes = new Map<string, PushOutcome>();

  const transport: PushTransport = {
    async send({ endpoint }, payload) {
      const outcome = outcomes.get(endpoint) ?? "accepted";

      if (outcome === "accepted") {
        pushes.push({ endpoint, message: pushMessage.parse(JSON.parse(payload)) });
      }

      return outcome;
    },
  };

  return {
    transport,
    pushes: () => [...pushes],
    answer(endpoint: string, outcome: PushOutcome) {
      outcomes.set(endpoint, outcome);
    },
  };
}

export type FakePush = ReturnType<typeof createFakePush>;
