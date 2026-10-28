import type { Album } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";
import type { MiniAppLinks } from "@/common/mini-app-link";
import type { PhotoLinks } from "@/common/photo-link";
import type { BotApi } from "@/common/telegram";

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
  bot: BotApi;
  appLinks: MiniAppLinks;
  petNotes: PetNotes;
};

export type AlbumRefusal = "not-found" | "not-owner" | "pet-album-fixed" | "photo-not-found";

export type AlbumResult = { status: "ok"; album: Album } | { status: AlbumRefusal };

export type ShareResult =
  | { status: "ok"; preparedMessageId: string }
  | { status: "not-found" | "photo-not-in-album" };
