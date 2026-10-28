import { Hono, type Context } from "hono";

import {
  albumChange,
  albumPhotos,
  type Album,
  type AlbumSummary,
  type Photo,
  type PreparedMessage,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { AlbumRefusal, AlbumResult } from "./album.types.ts";
import type { AlbumService } from "./service/album.service.ts";

type AlbumEnv = {
  Variables: MemberEnv["Variables"] & { albums: AlbumService };
};

const refuse = refusalsOf<AlbumRefusal>({
  "not-found": {
    code: "ALBUM_NOT_FOUND",
    message: "No such Album in the Family",
    status: httpStatus.notFound,
  },
  "not-owner": {
    code: "NOT_ALBUM_OWNER",
    message: "Only the Member who made an Album or the Family Owner may delete it",
    status: httpStatus.forbidden,
  },
  "pet-album-fixed": {
    code: "PET_ALBUM_FIXED",
    message: "A Pet's Album follows its Care Entries; it is neither renamed nor deleted",
    status: httpStatus.conflict,
  },
  "photo-not-found": {
    code: "PHOTO_NOT_FOUND",
    message: "Add photos uploaded to the Family",
    status: httpStatus.badRequest,
  },
});

const refuseShare = refusalsOf<"not-found" | "photo-not-in-album">({
  "not-found": {
    code: "ALBUM_NOT_FOUND",
    message: "No such Album in the Family",
    status: httpStatus.notFound,
  },
  "photo-not-in-album": {
    code: "PHOTO_NOT_FOUND",
    message: "No such photo in the Album",
    status: httpStatus.notFound,
  },
});

function reply(context: Context<AlbumEnv>, result: AlbumResult) {
  return result.status === "ok"
    ? context.json<Album>(result.album)
    : refuse(context, result.status);
}

export const albumRoute = new Hono<AlbumEnv>()
  .use("/api/albums/*", requireMember)
  .get("/api/photos", async (context) =>
    context.json<Photo[]>(await context.var.albums.allPhotos(context.var.membership)),
  )
  .get("/api/albums", async (context) =>
    context.json<AlbumSummary[]>(await context.var.albums.list(context.var.membership)),
  )
  .post(
    "/api/albums",
    jsonBody(albumChange, "An Album needs a title; a batch takes 1 to 50 photos"),
    async (context) => {
      const result = await context.var.albums.create(
        context.var.membership,
        context.req.valid("json"),
      );

      return result.status === "ok"
        ? context.json<Album>(result.album, httpStatus.created)
        : refuse(context, result.status);
    },
  )
  .get("/api/albums/:id", async (context) =>
    reply(context, await context.var.albums.get(context.var.membership, context.req.param("id"))),
  )
  .put(
    "/api/albums/:id",
    jsonBody(albumChange, "An Album needs a title; a batch takes 1 to 50 photos"),
    async (context) =>
      reply(
        context,
        await context.var.albums.update(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json"),
        ),
      ),
  )
  .delete("/api/albums/:id", async (context) => {
    const result = await context.var.albums.remove(
      context.var.membership,
      context.req.param("id"),
      context.req.query("withPhotos") === "true" ? "with-photos" : "album-only",
    );

    return result.status === "deleted" ? context.json(result) : refuse(context, result.status);
  })
  .post(
    "/api/albums/:id/photos",
    jsonBody(albumPhotos, "An Album needs a title; a batch takes 1 to 50 photos"),
    async (context) =>
      reply(
        context,
        await context.var.albums.addPhotos(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json").photoIds,
        ),
      ),
  )
  .delete("/api/albums/:id/photos/:photoId", async (context) =>
    reply(
      context,
      await context.var.albums.removePhoto(context.var.membership, {
        albumId: context.req.param("id"),
        photoId: context.req.param("photoId"),
      }),
    ),
  )
  .post("/api/albums/:id/photos/:photoId/share", async (context) => {
    const result = await context.var.albums.sharePhoto(context.var.membership, {
      albumId: context.req.param("id"),
      photoId: context.req.param("photoId"),
    });

    return result.status === "ok"
      ? context.json<PreparedMessage>({ preparedMessageId: result.preparedMessageId })
      : refuseShare(context, result.status);
  });
