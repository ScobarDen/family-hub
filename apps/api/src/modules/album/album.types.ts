import type { Album } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { PhotoLinks } from "@/common/photo-link.lib.ts";
import type { Membership } from "@/modules/auth";
import type { MiniAppLinks } from "@/modules/mini-app-link";
import type { BotApi } from "@/modules/telegram";

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
