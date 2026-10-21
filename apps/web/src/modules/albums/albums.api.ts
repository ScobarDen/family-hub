import {
  album,
  albumDeleted,
  albumList,
  photo,
  photoDeleted,
  photoList,
  type Album,
  type AlbumChange,
  type AlbumSummary,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedPhoto, resolvedUrls, type PreparedPhoto } from "@/common/photo";

function resolvedSummary(client: HttpClient, summary: AlbumSummary): AlbumSummary {
  return {
    ...summary,
    cover: summary.cover === null ? null : resolvedUrls(summary.cover, client.url),
  };
}

function resolvedAlbum(client: HttpClient, saved: Album): Album {
  return {
    ...saved,
    ...resolvedSummary(client, saved),
    photos: saved.photos.map((each) => resolvedPhoto(each, client.url)),
  };
}

function photoCalls(client: HttpClient) {
  return {
    async allPhotos() {
      const photos = await client.request("/api/photos", { schema: photoList });

      return photos.map((each) => resolvedPhoto(each, client.url));
    },
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

export function createAlbumsApi(client: HttpClient) {
  async function one(
    path: string,
    init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown },
  ) {
    const saved = await client.request(path, { ...init, schema: album });

    return resolvedAlbum(client, saved);
  }

  return {
    async list() {
      const summaries = await client.request("/api/albums", { schema: albumList });

      return summaries.map((summary) => resolvedSummary(client, summary));
    },
    get: async (albumId: string) => one(`/api/albums/${albumId}`, {}),
    create: async (change: AlbumChange) => one("/api/albums", { method: "POST", body: change }),
    update: async (albumId: string, change: AlbumChange) =>
      one(`/api/albums/${albumId}`, { method: "PUT", body: change }),
    remove: async (albumId: string, scope: "album-only" | "with-photos") =>
      client.request(`/api/albums/${albumId}${scope === "with-photos" ? "?withPhotos=true" : ""}`, {
        method: "DELETE",
        schema: albumDeleted,
      }),
    addPhotos: async (albumId: string, photoIds: string[]) =>
      one(`/api/albums/${albumId}/photos`, { method: "POST", body: { photoIds } }),
    ...photoCalls(client),
  };
}

export type AlbumsApi = ReturnType<typeof createAlbumsApi>;
