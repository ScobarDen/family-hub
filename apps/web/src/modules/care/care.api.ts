import {
  careEntry,
  careEntryDeleted,
  careEntryList,
  dueDateList,
  expenseSummary,
  photo,
  photoDeleted,
  type CareEntry,
  type CareEntryChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedPhoto, type PreparedPhoto } from "@/common/photo";

export type Range = { from: number; to: number };

function resolvedEntry(client: HttpClient, entry: CareEntry): CareEntry {
  return { ...entry, photos: entry.photos.map((each) => resolvedPhoto(each, client.url)) };
}

function photoCalls(client: HttpClient) {
  return {
    async uploadPhoto({ file, takenAt }: PreparedPhoto) {
      const form = new FormData();

      form.append("file", file, "photo.jpg");

      if (takenAt !== null) {
        form.append("takenAt", String(takenAt));
      }

      const uploaded = await client.request("/api/photos", {
        method: "POST",
        body: form,
        schema: photo,
      });

      return resolvedPhoto(uploaded, client.url);
    },
    deletePhoto: async (photoId: string) =>
      client.request(`/api/photos/${photoId}`, { method: "DELETE", schema: photoDeleted }),
  };
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
        schema: careEntryDeleted,
      }),
    dueDates: async (petId: string) =>
      client.request(`/api/pets/${petId}/due-dates`, { schema: dueDateList }),
    expenses: async (petId: string, { from, to }: Range) =>
      client.request(`/api/pets/${petId}/expenses?from=${from}&to=${to}`, {
        schema: expenseSummary,
      }),

    ...photoCalls(client),
  };
}

export type CareApi = ReturnType<typeof createCareApi>;
