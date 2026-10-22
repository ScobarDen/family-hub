import {
  album,
  albumDeleted,
  albumList,
  photoList,
  type Album,
  type AlbumChange,
  type AlbumSummary,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { createPhotoCalls, resolvedPhoto, resolvedUrls } from "@/common/photo";

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
    ...createPhotoCalls(client),
  };
}

export type AlbumsApi = ReturnType<typeof createAlbumsApi>;
