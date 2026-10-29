import { pushMessage, type PushMessage } from "@family-hub/contract";

import type { PushTransport } from "@/modules/push";

type Push = { endpoint: string; message: PushMessage };

// Records what reached each push service and answers 201, or the status set for an endpoint.
export function createFakePush() {
  const pushes: Push[] = [];
  const statuses = new Map<string, number>();

  const transport: PushTransport = {
    async send({ endpoint }, payload) {
      const status = statuses.get(endpoint) ?? 201;

      if (status < 300) {
        pushes.push({ endpoint, message: pushMessage.parse(JSON.parse(payload)) });
      }

      return status;
    },
  };

  return {
    transport,
    pushes: () => [...pushes],
    answer(endpoint: string, status: number) {
      statuses.set(endpoint, status);
    },
  };
}

export type FakePush = ReturnType<typeof createFakePush>;
