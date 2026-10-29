import { botChat, commandOutcome, draftCreated, draftSettled } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client.api.ts";

export function createCommandApi(client: HttpClient) {
  return {
    send: async (recording: Blob) =>
      client.request("/api/commands/voice", {
        method: "POST",
        body: recording,
        schema: commandOutcome,
      }),
    open: async (draftId: string) =>
      client.request(`/api/commands/${draftId}`, { schema: commandOutcome }),
    create: async (draftId: string) =>
      client.request(`/api/commands/${draftId}/create`, { method: "POST", schema: draftCreated }),
    pick: async (draftId: string, index: number) =>
      client.request(`/api/commands/${draftId}/pick`, {
        method: "POST",
        body: { index },
        schema: commandOutcome,
      }),
    dismiss: async (draftId: string) =>
      client.request(`/api/commands/${draftId}/dismiss`, { method: "POST", schema: draftSettled }),
    markCreated: async (draftId: string) =>
      client.request(`/api/commands/${draftId}/created`, { method: "POST", schema: draftSettled }),
    botChat: async () => client.request("/api/commands/bot", { schema: botChat }),
  };
}

export type CommandApi = ReturnType<typeof createCommandApi>;
