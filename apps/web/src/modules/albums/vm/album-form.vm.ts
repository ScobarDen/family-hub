import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import {
  albumChange,
  albumDescriptionMaxLength,
  albumTitleMaxLength,
  type Album,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";

import type { AlbumsApi } from "../albums.api.ts";

type AlbumFormDependencies = { api: AlbumsApi; onSaved: (saved: Album) => void };

const emptyAlbum = { title: "", description: "" };

type AlbumValues = typeof emptyAlbum;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(albumTitleMaxLength, "Слишком длинно"),
  description: z
    .string()
    .max(albumDescriptionMaxLength, `Не длиннее ${albumDescriptionMaxLength} символов`),
});

export function reatomAlbumForm({ api, onSaved }: AlbumFormDependencies) {
  const edited = atom<Album | undefined>(undefined, "albums.form.edited");
  const form = reatomForm(emptyAlbum, {
    name: "albums.form",
    schema,
    onSubmit: async (values: AlbumValues) => {
      const target = edited();
      const change = albumChange.parse({ ...values, coverPhotoId: target?.coverPhotoId ?? null });
      const saved = await wrap(
        target === undefined ? api.create(change) : api.update(target.id, change),
      );

      onSaved(saved);
    },
  });

  return {
    form,
    isCreating: computed(() => edited() === undefined, "albums.form.isCreating"),
    isSaving: computed(() => !form.submit.ready(), "albums.form.isSaving"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить альбом. Попробуйте ещё раз.",
      name: "albums.form.failure",
    }),

    startCreating: action(() => {
      edited.set(undefined);
      fillForm(form, emptyAlbum);
    }, "albums.form.startCreating"),
    startEditing: action((album: Album) => {
      edited.set(album);
      fillForm(form, { title: album.title, description: album.description ?? "" });
    }, "albums.form.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "albums.form.save"),
  };
}

export type AlbumFormModel = ReturnType<typeof reatomAlbumForm>;
