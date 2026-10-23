import {
  pet,
  deleted,
  petList,
  type Pet,
  type PetDeletion,
  type PetMemoChange,
  type PetProfile,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { createPhotoCalls } from "@/common/photo";

// The avatar is a signed path of the Worker; the browser loads it from there.
function resolvedOf(client: HttpClient, saved: Pet): Pet {
  const { avatar } = saved;

  return avatar === null
    ? saved
    : {
        ...saved,
        avatar: {
          thumb: client.url(avatar.thumb),
          medium: client.url(avatar.medium),
          full: client.url(avatar.full),
        },
      };
}

export function createPetsApi(client: HttpClient) {
  async function one(path: string, init: { method: "POST" | "PUT"; body?: unknown }) {
    const saved = await client.request(path, { ...init, schema: pet });

    return resolvedOf(client, saved);
  }

  return {
    ...createPhotoCalls(client),

    async list() {
      const pets = await client.request("/api/pets", { schema: petList });

      return pets.map((each) => resolvedOf(client, each));
    },

    create: async (profile: PetProfile) => one("/api/pets", { method: "POST", body: profile }),

    saveProfile: async (petId: string, profile: PetProfile) =>
      one(`/api/pets/${petId}`, { method: "PUT", body: profile }),

    saveMemo: async (petId: string, memo: PetMemoChange) =>
      one(`/api/pets/${petId}/memo`, { method: "PUT", body: memo }),

    setAvatar: async (petId: string, photoId: string | null) =>
      one(`/api/pets/${petId}/avatar`, { method: "PUT", body: { photoId } }),

    archive: async (petId: string) => one(`/api/pets/${petId}/archive`, { method: "POST" }),

    unarchive: async (petId: string) => one(`/api/pets/${petId}/unarchive`, { method: "POST" }),

    remove: async (petId: string, petName: string) =>
      client.request(`/api/pets/${petId}`, {
        method: "DELETE",
        body: { petName } satisfies PetDeletion,
        schema: deleted,
      }),
  };
}

export type PetsApi = ReturnType<typeof createPetsApi>;
