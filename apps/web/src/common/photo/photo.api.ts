import { photo, photoDeleted } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

import { resolvedPhoto, type PreparedPhoto } from "./photo.lib.ts";

export function createPhotoCalls(client: HttpClient) {
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
