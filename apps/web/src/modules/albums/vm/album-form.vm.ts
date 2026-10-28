import { action, reatomForm } from "@reatom/core";
import { z } from "zod";

import {
  albumChange,
  albumDescriptionMaxLength,
  albumTitleMaxLength,
  type Album,
  type AlbumChange,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";
import type { Haptics } from "@/common/telegram";

import type { AlbumsApi } from "../albums.api.ts";

type AlbumFormDependencies = {
  api: AlbumsApi;
  haptics: Pick<Haptics, "success" | "error">;
  onSaved: (saved: Album) => void;
};

const emptyAlbum = { title: "", description: "" };

type AlbumValues = typeof emptyAlbum;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(albumTitleMaxLength, "Слишком длинно"),
  description: z
    .string()
    .max(albumDescriptionMaxLength, `Не длиннее ${albumDescriptionMaxLength} символов`),
});

function changeOf(values: AlbumValues, coverPhotoId: string | null): AlbumChange {
  return albumChange.parse({ ...values, coverPhotoId });
}

export function reatomAlbumForm({ api, haptics, onSaved }: AlbumFormDependencies) {
  const record = reatomEditableRecord({
    name: "albums.record",
    form: (onSubmit) => reatomForm(emptyAlbum, { name: "albums.form", schema, onSubmit }),
    failureMessage: "Не получилось сохранить альбом. Попробуйте ещё раз.",
    haptics,
    valuesOf: (album: Album) => ({ title: album.title, description: album.description ?? "" }),
    create: async (values) => api.create(changeOf(values, null)),
    update: async (album: Album, values) =>
      api.update(album.id, changeOf(values, album.coverPhotoId)),
    onSaved,
  });

  return {
    ...record,
    startCreating: action(() => {
      record.startCreating(emptyAlbum);
    }, "albums.form.startCreating"),
  };
}

export type AlbumFormModel = ReturnType<typeof reatomAlbumForm>;
