import type { InlineQueryResultCachedPhoto } from "@grammyjs/types";

import { petAlbumPrefix, type Album, type AlbumSummary, type Photo } from "@family-hub/contract";

import type { PhotoLinks } from "@/common/photo-link.lib.ts";

import type { AlbumRow, PetRow, PhotoRow } from "./album.repo.ts";

export type Viewer = { memberId: string; isFamilyOwner: boolean };

export type AlbumSource = {
  id: string;
  kind: AlbumSummary["kind"];
  title: string;
  description: string | null;
  coverPhotoId: string | null;
  petId: string | null;
  photos: PhotoRow[];
  canEdit: boolean;
  canDelete: boolean;
};

// A photo without a moment of shooting sits at the moment it was uploaded.
export function momentOf(photo: PhotoRow): number {
  return photo.takenAt ?? photo.createdAt;
}

function byMoment(left: PhotoRow, right: PhotoRow): number {
  return momentOf(left) - momentOf(right);
}

// The one who made an Album and the Family Owner may delete it; any Member edits it.
export function albumSourceOf(
  row: AlbumRow,
  { photos, viewer }: { photos: PhotoRow[]; viewer: Viewer },
): AlbumSource {
  return {
    id: row.id,
    kind: "album",
    title: row.title,
    description: row.description,
    coverPhotoId: row.coverPhotoId,
    petId: null,
    photos,
    canEdit: true,
    canDelete: viewer.isFamilyOwner || row.createdBy === viewer.memberId,
  };
}

export function petSourceOf(pet: PetRow, photos: PhotoRow[]): AlbumSource {
  return {
    id: `${petAlbumPrefix}${pet.id}`,
    kind: "pet",
    title: pet.name,
    description: null,
    coverPhotoId: null,
    petId: pet.id,
    photos,
    canEdit: false,
    canDelete: false,
  };
}

export async function summaryOf(links: PhotoLinks, source: AlbumSource): Promise<AlbumSummary> {
  const sorted = source.photos.toSorted(byMoment);
  const cover = sorted.find(({ id }) => id === source.coverPhotoId) ?? sorted.at(-1);
  const first = sorted[0];
  const last = sorted.at(-1);

  return {
    id: source.id,
    kind: source.kind,
    title: source.title,
    description: source.description,
    cover: cover === undefined ? null : await links.urlsOf(cover.id),
    coverPhotoId: cover?.id ?? null,
    photoCount: sorted.length,
    from: first === undefined ? null : momentOf(first),
    to: last === undefined ? null : momentOf(last),
    petId: source.petId,
    canEdit: source.canEdit,
    canDelete: source.canDelete,
  };
}

export async function photosOf(
  links: PhotoLinks,
  { photos, viewer }: { photos: PhotoRow[]; viewer: Viewer },
): Promise<Photo[]> {
  return Promise.all(photos.toSorted(byMoment).map(async (photo) => links.photoOf(photo, viewer)));
}

export async function albumOf(
  links: PhotoLinks,
  { source, viewer }: { source: AlbumSource; viewer: Viewer },
): Promise<Album> {
  return {
    ...(await summaryOf(links, source)),
    photos: await photosOf(links, { photos: source.photos, viewer }),
  };
}

export function photoCard(
  photo: PhotoRow,
  { albumTitle, link }: { albumTitle: string; link: string },
): InlineQueryResultCachedPhoto {
  return {
    type: "photo",
    id: photo.id,
    photo_file_id: photo.variants.full,
    caption: albumTitle,
    reply_markup: { inline_keyboard: [[{ text: "Открыть", url: link }]] },
  };
}
