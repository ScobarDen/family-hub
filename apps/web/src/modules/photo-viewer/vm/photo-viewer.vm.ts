import {
  action,
  atom,
  computed,
  withAsync,
  withChangeHook,
  withRollback,
  wrap,
} from "@reatom/core";

import type { Photo } from "@family-hub/contract";

import { detached, reatomOptimistic, type RollbackFailure } from "@/modules/changes";
import {
  type Confirmation,
  type Dialogs,
  didSucceedOrAlert,
  type Fullscreen,
  isConfirmed,
  type Haptics,
} from "@/modules/telegram";

export type PhotoViewerDependencies = {
  api: { deletePhoto: (photoId: string) => Promise<unknown> };
  telegram: Dialogs & Fullscreen & { haptics: Haptics };
  // A module's own action on the photo shown, such as making it a Pet's avatar.
  onPick?: (photoId: string) => void;
  onDeleted: () => void;
  failure: RollbackFailure;
  sharing?: { isAvailable: () => boolean; share: (photoId: string) => Promise<unknown> };
};

type Opened = { photos: Photo[]; index: number };

const deleteQuestion: Confirmation = {
  title: "Удалить фото?",
  message: "Фото пропадёт у всей семьи: из записей и альбомов.",
  button: "Удалить",
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
  return reatomOptimistic(
    async () => {
      const current = opened();
      const photo = photoAt(current);

      if (current === undefined || photo === undefined) {
        return;
      }

      if (!(await wrap(isConfirmed(dependencies.telegram, deleteQuestion)))) {
        return;
      }

      opened.set(without(current, photo.id));
      await wrap(dependencies.api.deletePhoto(photo.id));
      dependencies.onDeleted();
    },
    {
      name: "photoViewer.remove",
      failure: dependencies.failure,
      refusal: "Не получилось удалить фото. Попробуйте ещё раз.",
    },
  );
}

function reatomPhotoSharing(
  { sharing, telegram }: PhotoViewerDependencies,
  opened: ReturnType<typeof atom<Opened | undefined>>,
) {
  return action(async () => {
    const photo = photoAt(opened());

    if (sharing === undefined || photo === undefined) {
      return;
    }

    await wrap(
      didSucceedOrAlert(telegram, {
        failure: "Не получилось поделиться фото. Попробуйте ещё раз.",
        call: sharing.share(photo.id),
      }),
    );
  }, "photoViewer.share").extend(withAsync());
}

// A failed deletion brings the photo back only to a viewer nobody has moved or closed since.
function reatomOpened(telegram: Fullscreen) {
  return atom<Opened | undefined>(undefined, "photoViewer.opened").extend(
    withRollback({
      onRollback: ({ beforeState, transactionState, currentState }) =>
        currentState === transactionState ? beforeState : currentState,
    }),
    withChangeHook((current, previous) => {
      if (previous === undefined && current !== undefined) {
        telegram.requestFullscreen();
      } else if (previous !== undefined && current === undefined) {
        telegram.exitFullscreen();
      }
    }),
  );
}

export function reatomPhotoViewer(dependencies: PhotoViewerDependencies) {
  const opened = reatomOpened(dependencies.telegram);
  const remove = reatomPhotoRemoval(dependencies, opened);
  const share = reatomPhotoSharing(dependencies, opened);

  return {
    current: computed(() => currentOf(opened()), "photoViewer.current"),
    isRemoving: computed(() => !remove.ready(), "photoViewer.isRemoving"),
    canShare: computed(() => dependencies.sharing?.isAvailable() ?? false, "photoViewer.canShare"),
    isSharing: computed(() => !share.ready(), "photoViewer.isSharing"),
    // The modal viewer makes the module's own failure bar inert and covers it, so it shows its own.
    failure: dependencies.failure.failure,
    dismissFailure: dependencies.failure.dismiss,

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
    remove: detached(remove, "photoViewer.removePhoto"),
    share: detached(share, "photoViewer.sharePhoto"),
  };
}

export type PhotoViewerModel = ReturnType<typeof reatomPhotoViewer>;
