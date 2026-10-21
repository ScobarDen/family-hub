import { photoStorage } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createPhotoStorageApi(client: HttpClient) {
  return {
    status: async () => client.request("/api/family/photo-storage", { schema: photoStorage }),
  };
}

export type PhotoStorageApi = ReturnType<typeof createPhotoStorageApi>;
