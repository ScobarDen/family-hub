import {
  action,
  atom,
  computed,
  noop,
  reatomBoolean,
  withAsync,
  wrap,
  type Atom,
  type BooleanAtom,
} from "@reatom/core";

import type { Photo } from "@family-hub/contract";

import type { PreparedPhoto } from "@/common/photo";
import { reatomPhotoViewer } from "@/common/photo-viewer";
import { detached, readOnly } from "@/common/state";
import { didSucceedOrAlert, type Dialogs, type PopupParams } from "@/common/telegram";

import type { AlbumsApi } from "../albums.api.ts";
import { subtitleOf, toItem, type AlbumItem, type AlbumView } from "../albums.lib.ts";
import { reatomAlbumsData, type AlbumsData } from "../albums.model.ts";
import { reatomAlbumForm } from "./album-form.vm.ts";
import { reatomBatchUpload } from "./batch-upload.vm.ts";

export type AlbumsScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "list"; albums: AlbumItem[] }
  | { kind: "album"; album: AlbumView }
  | { kind: "all"; photos: Photo[] }
  | { kind: "form"; isCreating: boolean };

type AlbumsDependencies = {
  api: AlbumsApi;
  telegram: Dialogs;
  timeZone: () => string;
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  wait: (ms: number) => Promise<void>;
  photoHint: () => string | undefined;
};

type Navigation = { openedId: Atom<string | undefined>; isEditing: BooleanAtom };

const deleteQuestion: PopupParams = {
  title: "Удалить альбом?",
  message: "Фото, которые есть в других альбомах или записях питомца, останутся в любом случае.",
  buttons: [
    { id: "album-only", type: "default", text: "Только альбом" },
    { id: "with-photos", type: "destructive", text: "Альбом и фото" },
    { id: "cancel", type: "cancel" },
  ],
};

function reatomScreen(
  { timeZone }: AlbumsDependencies,
  {
    data,
    navigation,
    form,
  }: { data: AlbumsData; navigation: Navigation; form: { isCreating: () => boolean } },
) {
  return computed((): AlbumsScreen => {
    if (navigation.isEditing()) {
      return { kind: "form", isCreating: form.isCreating() };
    }

    if (data.isAllShown()) {
      return { kind: "all", photos: data.allPhotos.data() ?? [] };
    }

    const opened = data.opened.data();

    if (navigation.openedId() !== undefined && opened !== undefined) {
      return { kind: "album", album: { ...opened, subtitle: subtitleOf(opened, timeZone()) } };
    }

    const list = data.list.data();

    if (list === undefined) {
      return data.list.error() === undefined ? { kind: "loading" } : { kind: "failed" };
    }

    return { kind: "list", albums: list.map((summary) => toItem(summary, timeZone())) };
  }, "albums.screen");
}

function reatomRemoval(
  dependencies: AlbumsDependencies,
  { data, navigation }: { data: AlbumsData; navigation: Navigation },
) {
  return action(async () => {
    const albumId = navigation.openedId();
    const choice = await wrap(dependencies.telegram.showPopup(deleteQuestion));

    if (albumId === undefined || (choice !== "album-only" && choice !== "with-photos")) {
      return;
    }

    const isRemoved = await wrap(
      didSucceedOrAlert(dependencies.telegram, {
        failure: "Не получилось удалить альбом. Попробуйте ещё раз.",
        call: dependencies.api.remove(albumId, choice),
      }),
    );

    if (isRemoved) {
      navigation.openedId.set(undefined);
      data.reload();
    }
  }, "albums.remove").extend(withAsync());
}

// In an Album the viewer's own action picks the photo shown as its cover.
function reatomAlbumViewer(dependencies: AlbumsDependencies, data: AlbumsData) {
  const { api } = dependencies;
  const pickCover = action(async (photoId: string) => {
    const album = data.opened.data();

    if (album?.canEdit !== true) {
      return;
    }

    await wrap(
      api.update(album.id, {
        title: album.title,
        description: album.description,
        coverPhotoId: photoId,
      }),
    );
    data.reload();
  }, "albums.pickCover").extend(withAsync());

  return reatomPhotoViewer({
    ...dependencies,
    onPick: (photoId) => {
      pickCover(photoId).catch(noop);
    },
    onDeleted: data.reload,
  });
}

function reatomParts(
  dependencies: AlbumsDependencies,
  { data, navigation }: { data: AlbumsData; navigation: Navigation },
) {
  const { api } = dependencies;

  return {
    form: reatomAlbumForm({
      api,
      onSaved: (saved) => {
        navigation.isEditing.setFalse();
        navigation.openedId.set(saved.id);
        data.reload();
      },
    }),
    batch: reatomBatchUpload({
      ...dependencies,
      upload: async (prepared) => api.uploadPhoto(prepared),
      addToAlbum: async (albumId, photo) => api.addPhotos(albumId, [photo.id]),
      onFinished: data.reload,
    }),
    viewer: reatomAlbumViewer(dependencies, data),
  };
}

export function reatomAlbumsScreen(dependencies: AlbumsDependencies) {
  const navigation: Navigation = {
    openedId: atom<string | undefined>(undefined, "albums.openedId"),
    isEditing: reatomBoolean(false, "albums.isEditing"),
  };
  const data = reatomAlbumsData({ api: dependencies.api, openedId: navigation.openedId });
  const parts = reatomParts(dependencies, { data, navigation });
  const screen = reatomScreen(dependencies, { data, navigation, form: parts.form });
  const remove = reatomRemoval(dependencies, { data, navigation });

  return {
    screen,
    ...parts,
    photoHint: readOnly(dependencies.photoHint),
    title: computed(() => titleOf(screen()), "albums.title"),
    canGoBack: computed(
      () => navigation.isEditing() || data.isAllShown() || navigation.openedId() !== undefined,
      "albums.canGoBack",
    ),
    open: action((albumId: string) => {
      navigation.openedId.set(albumId);
    }, "albums.open"),
    openAll: action(() => {
      data.isAllShown.setTrue();
    }, "albums.openAll"),
    ...reatomMoves({ data, navigation, form: parts.form, batch: parts.batch }),
    remove: detached(remove, "albums.removeAlbum"),
  };
}

function reatomMoves({
  data,
  navigation,
  form,
  batch,
}: {
  data: AlbumsData;
  navigation: Navigation;
  form: ReturnType<typeof reatomAlbumForm>;
  batch: ReturnType<typeof reatomBatchUpload>;
}) {
  return {
    add: action(() => {
      form.startCreating();
      navigation.isEditing.setTrue();
    }, "albums.add"),
    edit: action(() => {
      const album = data.opened.data();

      if (album !== undefined) {
        form.startEditing(album);
        navigation.isEditing.setTrue();
      }
    }, "albums.edit"),
    upload: action((files: Blob[]) => {
      batch.start(navigation.openedId(), files);
    }, "albums.upload"),
    back: action(() => {
      if (navigation.isEditing()) {
        navigation.isEditing.setFalse();
      } else if (data.isAllShown()) {
        data.isAllShown.setFalse();
      } else {
        navigation.openedId.set(undefined);
        batch.dismiss();
      }
    }, "albums.back"),
  };
}

function titleOf(screen: AlbumsScreen): string {
  if (screen.kind === "album") {
    return screen.album.title;
  }

  if (screen.kind === "form") {
    return screen.isCreating ? "Новый альбом" : "Альбом";
  }

  return screen.kind === "all" ? "Все фото" : "Альбомы";
}

export type AlbumsScreenModel = ReturnType<typeof reatomAlbumsScreen>;
