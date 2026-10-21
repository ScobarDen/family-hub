import { petAlbumPrefix, type AlbumSummary, type Photo } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import { albumSourceOf, petSourceOf, photosOf, summaryOf, type AlbumSource } from "../album.lib.ts";
import type { AlbumDependencies } from "../album.types.ts";

export function viewerOf({ member, isFamilyOwner }: Membership) {
  return { memberId: member.id, isFamilyOwner };
}

// Every Album the Family sees: its own ones first by when they were made, then each Pet's.
export async function sourcesOf(
  { albums }: AlbumDependencies,
  membership: Membership,
): Promise<AlbumSource[]> {
  const familyId = membership.family.id;
  const viewer = viewerOf(membership);
  const [rows, inAlbums, pets, ofPets] = await Promise.all([
    albums.albumsOf(familyId),
    albums.albumPhotosOf(familyId),
    albums.petsOf(familyId),
    albums.petPhotosOf(familyId),
  ]);

  return [
    ...rows
      .toSorted((left, right) => left.createdAt - right.createdAt)
      .map((row) =>
        albumSourceOf(row, {
          photos: inAlbums.filter(({ albumId }) => albumId === row.id).map(({ photo }) => photo),
          viewer,
        }),
      ),
    ...pets.map((pet) =>
      petSourceOf(
        pet,
        ofPets.filter(({ petId }) => petId === pet.id).map(({ photo }) => photo),
      ),
    ),
  ];
}

export async function sourceOf(
  dependencies: AlbumDependencies,
  membership: Membership,
  albumId: string,
): Promise<AlbumSource | undefined> {
  const sources = await sourcesOf(dependencies, membership);

  return sources.find(({ id }) => id === albumId);
}

export async function list(
  dependencies: AlbumDependencies,
  membership: Membership,
): Promise<AlbumSummary[]> {
  const sources = await sourcesOf(dependencies, membership);

  return Promise.all(sources.map(async (source) => summaryOf(dependencies.links, source)));
}

export async function allPhotos(
  { albums, links }: AlbumDependencies,
  membership: Membership,
): Promise<Photo[]> {
  return photosOf(links, {
    photos: await albums.allPhotos(membership.family.id),
    viewer: viewerOf(membership),
  });
}

export function petIdOf(albumId: string): string | undefined {
  return albumId.startsWith(petAlbumPrefix) ? albumId.slice(petAlbumPrefix.length) : undefined;
}
