import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import { careEntryPhotoMax, type Photo } from "@family-hub/contract";

import { PhotoTooLargeError, type PreparedPhoto } from "@/common/photo";

import type { CareApi } from "../care.api.ts";

export type Attachment =
  | { key: string; status: "uploading" }
  | { key: string; status: "ready"; photo: Photo }
  | { key: string; status: "failed"; reason: string };

export type EntryPhotosDependencies = {
  api: Pick<CareApi, "uploadPhoto">;
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  canUploadPhotos: () => boolean;
};

function reasonOf(error: unknown): string {
  return error instanceof PhotoTooLargeError
    ? "Фото больше 10 МБ"
    : "Не загрузилось, попробуйте ещё раз";
}

let lastKey = 0;

function reatomUpload(
  { api, preparePhoto }: Pick<EntryPhotosDependencies, "api" | "preparePhoto">,
  items: Atom<Attachment[]>,
) {
  function settle(key: string, attachment: Attachment) {
    items.set(items().map((item) => (item.key === key ? attachment : item)));
  }

  return action(async (file: Blob) => {
    lastKey += 1;

    const key = `photo-${lastKey}`;

    items.set([...items(), { key, status: "uploading" }]);

    try {
      const prepared = await wrap(preparePhoto(file));
      const photo = await wrap(api.uploadPhoto(prepared));

      settle(key, { key, status: "ready", photo });
    } catch (error) {
      settle(key, { key, status: "failed", reason: reasonOf(error) });
    }
  }, "care.photos.uploadOne").extend(withAsync());
}

// Photos go up as soon as they are picked, so saving the entry only links what is already there.
export function reatomEntryPhotos({ api, preparePhoto, canUploadPhotos }: EntryPhotosDependencies) {
  const items = atom<Attachment[]>([], "care.photos.items");

  const uploadOne = reatomUpload({ api, preparePhoto }, items);

  return {
    items: computed(() => items(), "care.photos.list"),
    photoIds: computed(
      () => items().flatMap((item) => (item.status === "ready" ? [item.photo.id] : [])),
      "care.photos.ids",
    ),
    isUploading: computed(
      () => items().some(({ status }) => status === "uploading"),
      "care.photos.isUploading",
    ),
    canAdd: computed(
      () => canUploadPhotos() && items().length < careEntryPhotoMax,
      "care.photos.canAdd",
    ),

    add: action((files: Blob[]) => {
      for (const file of files.slice(0, careEntryPhotoMax - items().length)) {
        uploadOne(file).catch(noop);
      }
    }, "care.photos.add"),
    remove: action((key: string) => {
      items.set(items().filter((item) => item.key !== key));
    }, "care.photos.remove"),
    reset: action((photos: Photo[]) => {
      items.set(photos.map((photo): Attachment => ({ key: photo.id, status: "ready", photo })));
    }, "care.photos.reset"),
  };
}

export type EntryPhotosModel = ReturnType<typeof reatomEntryPhotos>;
