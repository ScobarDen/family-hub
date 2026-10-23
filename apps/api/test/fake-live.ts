import { liveProtocol } from "@family-hub/contract";

// The Family Durable Objects, reduced to the module names each one was told to relay.
export function createFakeLive() {
  const signals: Array<{ familyId: string; modules: string[] }> = [];
  const opened: string[] = [];

  const binding = {
    getByName: (familyId: string) => ({
      async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
        if (input instanceof Request) {
          opened.push(familyId);

          return new Response(null, { headers: { "sec-websocket-protocol": liveProtocol } });
        }

        signals.push({ familyId, modules: JSON.parse(init?.body as string) as string[] });

        return new Response(null, { status: 204 });
      },
    }),
  };

  return {
    // The Worker only ever calls getByName(...).fetch; the rest of the binding is not used.
    binding: binding as unknown as Env["LIVE"],
    signals,
    opened,
  };
}

export type FakeLive = ReturnType<typeof createFakeLive>;
