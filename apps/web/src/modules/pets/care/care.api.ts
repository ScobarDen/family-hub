import {
  careEntry,
  deleted,
  careEntryList,
  expenseSummary,
  type CareEntry,
  type CareEntryChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { createPhotoCalls, resolvedPhoto } from "@/common/photo";

export type Range = { from: number; to: number };

function resolvedEntry(client: HttpClient, entry: CareEntry): CareEntry {
  return { ...entry, photos: entry.photos.map((each) => resolvedPhoto(each, client.url)) };
}

async function entriesOf(client: HttpClient, petId: string): Promise<CareEntry[]> {
  const entries = await client.request(`/api/pets/${petId}/care-entries`, {
    schema: careEntryList,
  });

  return entries.map((entry) => resolvedEntry(client, entry));
}

export function createCareApi(client: HttpClient) {
  async function saved(saving: Promise<CareEntry>): Promise<CareEntry> {
    return resolvedEntry(client, await saving);
  }

  return {
    list: async (petId: string) => entriesOf(client, petId),
    get: async (entryId: string) =>
      saved(client.request(`/api/care-entries/${entryId}`, { schema: careEntry })),
    create: async (petId: string, change: CareEntryChange) =>
      saved(
        client.request(`/api/pets/${petId}/care-entries`, {
          method: "POST",
          body: change,
          schema: careEntry,
        }),
      ),
    update: async (entryId: string, change: CareEntryChange) =>
      saved(
        client.request(`/api/care-entries/${entryId}`, {
          method: "PUT",
          body: change,
          schema: careEntry,
        }),
      ),
    remove: async (entryId: string) =>
      client.request(`/api/care-entries/${entryId}`, {
        method: "DELETE",
        schema: deleted,
      }),
    expenses: async (petId: string, { from, to }: Range) =>
      client.request(`/api/pets/${petId}/expenses?from=${from}&to=${to}`, {
        schema: expenseSummary,
      }),

    ...createPhotoCalls(client),
  };
}

export type CareApi = ReturnType<typeof createCareApi>;
