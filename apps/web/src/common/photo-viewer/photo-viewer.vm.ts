import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";

import type { Photo } from "@family-hub/contract";

import type { PopupParams } from "@/common/telegram";

export type PhotoViewerDependencies = {
  api: { deletePhoto: (photoId: string) => Promise<unknown> };
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  // A module's own action on the photo shown, such as making it a Pet's avatar.
  onPick?: (photoId: string) => void;
  onDeleted: () => void;
};

type Opened = { photos: Photo[]; index: number };

const deleteQuestion: PopupParams = {
  title: "Удалить фото?",
  message: "Фото пропадёт у всей семьи: из записей и альбомов.",
  buttons: [
    { id: "delete", type: "destructive", text: "Удалить" },
    { id: "cancel", type: "cancel" },
  ],
};

function without({ photos, index }: Opened, photoId: string): Opened | undefined {
  const left = photos.filter(({ id }) => id !== photoId);

  return left.length === 0 ? undefined : { photos: left, index: Math.min(index, left.length - 1) };
}

function currentOf(opened: Opened | undefined) {
  return (
    opened && {
      photo: opened.photos[opened.index],
      position: `${opened.index + 1} / ${opened.photos.length}`,
    }
  );
}

function photoAt(opened: Opened | undefined) {
  return opened?.photos[opened.index];
}

function stepped(current: Opened | undefined, by: number): Opened | undefined {
  if (current === undefined) {
    return undefined;
  }

  const count = current.photos.length;

  return { ...current, index: (current.index + by + count) % count };
}

function reatomPhotoRemoval(
  dependencies: PhotoViewerDependencies,
  opened: ReturnType<typeof atom<Opened | undefined>>,
) {
  return action(async () => {
    const current = opened();
    const photo = photoAt(current);

    if (current === undefined || photo === undefined) {
      return;
    }

    const choice = await wrap(dependencies.telegram.showPopup(deleteQuestion));

    if (choice === "delete") {
      await wrap(dependencies.api.deletePhoto(photo.id));
      dependencies.onDeleted();
      opened.set(without(current, photo.id));
    }
  }, "photoViewer.remove").extend(withAsync());
}

export function reatomPhotoViewer(dependencies: PhotoViewerDependencies) {
  const opened = atom<Opened | undefined>(undefined, "photoViewer.opened");
  const remove = reatomPhotoRemoval(dependencies, opened);

  return {
    current: computed(() => currentOf(opened()), "photoViewer.current"),
    isRemoving: computed(() => !remove.ready(), "photoViewer.isRemoving"),

    open: action((photos: Photo[], photoId: string) => {
      opened.set({
        photos,
        index: Math.max(
          0,
          photos.findIndex(({ id }) => id === photoId),
        ),
      });
    }, "photoViewer.open"),
    close: action(() => {
      opened.set(undefined);
    }, "photoViewer.close"),
    next: action(() => {
      opened.set(stepped(opened(), 1));
    }, "photoViewer.next"),
    previous: action(() => {
      opened.set(stepped(opened(), -1));
    }, "photoViewer.previous"),
    pick: action(() => {
      const photo = photoAt(opened());

      if (photo !== undefined) {
        dependencies.onPick?.(photo.id);
      }
    }, "photoViewer.pick"),
    remove: action(() => {
      remove().catch(noop);
    }, "photoViewer.removePhoto"),
  };
}

export type PhotoViewerModel = ReturnType<typeof reatomPhotoViewer>;
