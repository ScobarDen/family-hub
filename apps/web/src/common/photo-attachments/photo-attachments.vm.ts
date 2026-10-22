import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import type { Photo } from "@family-hub/contract";

import { PhotoTooLargeError, type PreparedPhoto } from "@/common/photo";
import { readOnly } from "@/common/state";

export type Attachment =
  | { key: string; status: "uploading" }
  | { key: string; status: "ready"; photo: Photo }
  | { key: string; status: "failed"; reason: string };

export type PhotoAttachmentsDependencies = {
  api: { uploadPhoto: (prepared: PreparedPhoto) => Promise<Photo> };
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  canUploadPhotos: () => boolean;
  // How many photos the record takes: five for a Care Entry, ten for a Recipe.
  max: number;
};

function reasonOf(error: unknown): string {
  return error instanceof PhotoTooLargeError
    ? "Фото больше 10 МБ"
    : "Не загрузилось, попробуйте ещё раз";
}

let lastKey = 0;

function reatomUpload(
  { api, preparePhoto }: Pick<PhotoAttachmentsDependencies, "api" | "preparePhoto">,
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
  }, "photoAttachments.uploadOne").extend(withAsync());
}

// Photos go up as soon as they are picked, so saving the record only links what is already there.
export function reatomPhotoAttachments({
  api,
  preparePhoto,
  canUploadPhotos,
  max,
}: PhotoAttachmentsDependencies) {
  const items = atom<Attachment[]>([], "photoAttachments.items");

  const uploadOne = reatomUpload({ api, preparePhoto }, items);

  return {
    items: readOnly(items),
    photoIds: computed(
      () => items().flatMap((item) => (item.status === "ready" ? [item.photo.id] : [])),
      "photoAttachments.ids",
    ),
    isUploading: computed(
      () => items().some(({ status }) => status === "uploading"),
      "photoAttachments.isUploading",
    ),
    canAdd: computed(() => canUploadPhotos() && items().length < max, "photoAttachments.canAdd"),

    add: action((files: Blob[]) => {
      for (const file of files.slice(0, max - items().length)) {
        uploadOne(file).catch(noop);
      }
    }, "photoAttachments.add"),
    remove: action((key: string) => {
      items.set(items().filter((item) => item.key !== key));
    }, "photoAttachments.remove"),
    reset: action((photos: Photo[]) => {
      items.set(photos.map((photo): Attachment => ({ key: photo.id, status: "ready", photo })));
    }, "photoAttachments.reset"),
  };
}

export type PhotoAttachmentsModel = ReturnType<typeof reatomPhotoAttachments>;
