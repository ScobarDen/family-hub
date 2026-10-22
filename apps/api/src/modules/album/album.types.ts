import type { Album } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { PhotoLinks } from "@/common/photo-link";

import type { AlbumRepo } from "./album.repo.ts";

// Adding photos to a Pet's automatic Album writes a Care Entry «Заметка»; the app wires this port.
type PetNotes = {
  addNote(
    membership: Membership,
    { petId, photoIds }: { petId: string; photoIds: string[] },
  ): Promise<void>;
};

export type AlbumDependencies = {
  albums: AlbumRepo;
  links: PhotoLinks;
  clock: Clock;
  petNotes: PetNotes;
};

export type AlbumRefusal = "not-found" | "not-owner" | "pet-album-fixed" | "photo-not-found";

export type AlbumResult = { status: "ok"; album: Album } | { status: AlbumRefusal };
