import { z } from "zod";

import { photo, photoUrls } from "./photo.ts";
import { optionalText } from "./text.ts";

export const albumTitleMaxLength = 100;
export const albumDescriptionMaxLength = 1000;
export const albumBatchMax = 50;

// A Pet's automatic Album is computed from its Care Entries and is known by the Pet.
export const petAlbumPrefix = "pet-";

export const albumChange = z.object({
  title: z.string().trim().min(1).max(albumTitleMaxLength),
  description: optionalText(albumDescriptionMaxLength),
  coverPhotoId: z.string().nullable().default(null),
});

export type AlbumChange = z.infer<typeof albumChange>;

export const albumSummary = z.object({
  id: z.string(),
  kind: z.enum(["album", "pet"]),
  title: z.string(),
  description: z.string().nullable(),
  cover: photoUrls.nullable(),
  coverPhotoId: z.string().nullable(),
  photoCount: z.number(),
  // The span of its photos' moments, taken or else uploaded.
  from: z.number().nullable(),
  to: z.number().nullable(),
  petId: z.string().nullable(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

export type AlbumSummary = z.infer<typeof albumSummary>;

export const albumList = z.array(albumSummary);

export const album = albumSummary.extend({ photos: z.array(photo) });

export type Album = z.infer<typeof album>;

export const albumPhotos = z.object({
  photoIds: z.array(z.string()).min(1).max(albumBatchMax),
});

export type AlbumPhotos = z.infer<typeof albumPhotos>;

export const albumDeleted = z.object({ status: z.literal("deleted") });

export const photoList = z.array(photo);
