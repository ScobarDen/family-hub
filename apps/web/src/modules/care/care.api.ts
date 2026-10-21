import {
  careEntry,
  careEntryDeleted,
  careEntryList,
  expenseSummary,
  type CareEntryChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export type Range = { from: number; to: number };

export function createCareApi(client: HttpClient) {
  return {
    list: async (petId: string) =>
      client.request(`/api/pets/${petId}/care-entries`, { schema: careEntryList }),
    create: async (petId: string, change: CareEntryChange) =>
      client.request(`/api/pets/${petId}/care-entries`, {
        method: "POST",
        body: change,
        schema: careEntry,
      }),
    update: async (entryId: string, change: CareEntryChange) =>
      client.request(`/api/care-entries/${entryId}`, {
        method: "PUT",
        body: change,
        schema: careEntry,
      }),
    remove: async (entryId: string) =>
      client.request(`/api/care-entries/${entryId}`, {
        method: "DELETE",
        schema: careEntryDeleted,
      }),
    expenses: async (petId: string, { from, to }: Range) =>
      client.request(`/api/pets/${petId}/expenses?from=${from}&to=${to}`, {
        schema: expenseSummary,
      }),
  };
}

export type CareApi = ReturnType<typeof createCareApi>;
