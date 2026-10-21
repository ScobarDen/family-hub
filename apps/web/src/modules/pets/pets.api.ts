import {
  pet,
  petDeleted,
  petList,
  type PetDeletion,
  type PetMemoChange,
  type PetProfile,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createPetsApi(client: HttpClient) {
  return {
    list: async () => client.request("/api/pets", { schema: petList }),

    create: async (profile: PetProfile) =>
      client.request("/api/pets", { method: "POST", body: profile, schema: pet }),

    saveProfile: async (petId: string, profile: PetProfile) =>
      client.request(`/api/pets/${petId}`, { method: "PUT", body: profile, schema: pet }),

    saveMemo: async (petId: string, memo: PetMemoChange) =>
      client.request(`/api/pets/${petId}/memo`, { method: "PUT", body: memo, schema: pet }),

    archive: async (petId: string) =>
      client.request(`/api/pets/${petId}/archive`, { method: "POST", schema: pet }),

    unarchive: async (petId: string) =>
      client.request(`/api/pets/${petId}/unarchive`, { method: "POST", schema: pet }),

    remove: async (petId: string, petName: string) =>
      client.request(`/api/pets/${petId}`, {
        method: "DELETE",
        body: { petName } satisfies PetDeletion,
        schema: petDeleted,
      }),
  };
}

export type PetsApi = ReturnType<typeof createPetsApi>;
