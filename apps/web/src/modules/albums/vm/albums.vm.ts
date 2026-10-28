import {
  action,
  atom,
  type Atom,
  type BooleanAtom,
  computed,
  noop,
  reatomBoolean,
  withAsync,
  wrap,
} from "@reatom/core";

import type { AlbumSummary, Photo } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import { reatomFormBack } from "@/common/form";
import { formatCount } from "@/common/format-count";
import type { Viewer } from "@/common/format-date";
import type { LiveVersion } from "@/common/live-updates";
import type { PreparedPhoto } from "@/common/photo";
import { reatomPhotoViewer } from "@/common/photo-viewer";
import { withoutId } from "@/common/records";
import {
  detached,
  instantly,
  readOnly,
  reatomOptimistic,
  reatomRollbackFailure,
  type RollbackFailure,
  type Slide,
} from "@/common/state";
import {
  type ClosingConfirmation,
  type Dialogs,
  type Fullscreen,
  type PopupParams,
  type Haptics,
} from "@/common/telegram";

import type { AlbumsApi } from "../albums.api.ts";
import { subtitleOf, toItem, type AlbumItem, type AlbumView } from "../albums.lib.ts";
import { reatomAlbumsData, type AlbumsData } from "../albums.model.ts";
import { reatomAlbumForm } from "./album-form.vm.ts";
import { reatomBatchUpload } from "./batch-upload.vm.ts";

const albumWords = { one: "альбом", few: "альбома", many: "альбомов", other: "альбома" };

function listScreenOf(list: AlbumSummary[], viewer: Viewer): AlbumsScreen {
  return {
    kind: "list",
    albums: list.map((summary) => toItem(summary, viewer)),
    summary: list.length === 0 ? "Пока нет альбомов" : formatCount(list.length, albumWords),
  };
}

export type AlbumsScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "list"; albums: AlbumItem[]; summary: string }
  | { kind: "album"; album: AlbumView }
  | { kind: "all"; photos: Photo[] | undefined };

type AlbumsDependencies = LiveVersion & {
  api: AlbumsApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
  telegram: Dialogs &
    Fullscreen &
    ClosingConfirmation & {
      haptics: Haptics;
      canShareMessage: boolean;
      shareMessage: (preparedMessageId: string) => Promise<boolean>;
    };
  viewer: () => Viewer;
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  wait: (ms: number) => Promise<void>;
  photoHint: () => string | undefined;
  // The Family Owner can connect the photo channel, so a closed upload leads them to it.
  canSetUpPhotos: () => boolean;
  onSetUpPhotos: () => void;
  slide?: Slide;
};

type Navigation = { openedId: Atom<string | undefined>; isEditing: BooleanAtom };

const deleteQuestion: PopupParams = {
  title: "Удалить альбом?",
  message: "Фото, которые есть в других альбомах или записях питомца, останутся в любом случае.",
  buttons: [
    { id: "album-only", type: "default", text: "Удалить только альбом" },
    { id: "with-photos", type: "destructive", text: "Удалить альбом и фото" },
    { id: "cancel", type: "cancel" },
  ],
};

function reatomScreen(
  { viewer }: AlbumsDependencies,
  { data, navigation }: { data: AlbumsData; navigation: Navigation },
) {
  return computed((): AlbumsScreen => {
    if (data.isAllShown()) {
      return { kind: "all", photos: data.allPhotos.data() };
    }

    const opened = data.opened.data();

    if (navigation.openedId() !== undefined && opened !== undefined) {
      return { kind: "album", album: { ...opened, subtitle: subtitleOf(opened, viewer()) } };
    }

    const list = data.list.data();

    if (list === undefined) {
      return data.list.error() === undefined ? { kind: "loading" } : { kind: "failed" };
    }

    return listScreenOf(list, viewer());
  }, "albums.screen");
}

// Which screen is shown, apart from the data it shows, so a renamed Album keeps focus where it is.
function reatomPlace({ data, navigation }: { data: AlbumsData; navigation: Navigation }) {
  return {
    screenKey: computed(
      () => (data.isAllShown() ? "all" : (navigation.openedId() ?? "list")),
      "albums.screenKey",
    ),
    canGoBack: computed(
      () => navigation.isEditing() || data.isAllShown() || navigation.openedId() !== undefined,
      "albums.canGoBack",
    ),
  };
}

function reatomRemoval(
  dependencies: AlbumsDependencies,
  {
    data,
    navigation,
    failure,
  }: { data: AlbumsData; navigation: Navigation; failure: RollbackFailure },
) {
  return reatomOptimistic(
    async () => {
      const albumId = navigation.openedId();

      dependencies.telegram.haptics.warning();

      const choice = await wrap(dependencies.telegram.showPopup(deleteQuestion));

      if (albumId === undefined || (choice !== "album-only" && choice !== "with-photos")) {
        return;
      }

      data.list.data.set(withoutId(data.list.data() ?? [], albumId));
      navigation.openedId.set(undefined);
      await wrap(dependencies.api.remove(albumId, choice));
      data.reload();
    },
    {
      name: "albums.remove",
      failure,
      refusal: "Не получилось удалить альбом. Попробуйте ещё раз.",
    },
  );
}

// «Все фото» belong to no one Album, and a shared photo opens its Album.
function photoSharing(
  { api, telegram }: AlbumsDependencies,
  { data, navigation }: { data: AlbumsData; navigation: Navigation },
) {
  function sharedAlbumId() {
    return data.isAllShown() ? undefined : navigation.openedId();
  }

  return {
    isAvailable: () => telegram.canShareMessage && sharedAlbumId() !== undefined,
    async share(photoId: string) {
      const albumId = sharedAlbumId();

      if (albumId !== undefined) {
        const { preparedMessageId } = await wrap(api.sharePhoto(albumId, photoId));

        await wrap(telegram.shareMessage(preparedMessageId));
      }
    },
  };
}

// In an Album the viewer's own action picks the photo shown as its cover.
function reatomAlbumViewer(
  dependencies: AlbumsDependencies,
  sources: { data: AlbumsData; navigation: Navigation; failure: RollbackFailure },
) {
  const { api } = dependencies;
  const { data } = sources;
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
    failure: sources.failure,
    sharing: photoSharing(dependencies, sources),
  });
}

function reatomParts(
  dependencies: AlbumsDependencies,
  {
    data,
    navigation,
    failure,
  }: { data: AlbumsData; navigation: Navigation; failure: RollbackFailure },
) {
  const { api } = dependencies;

  return {
    form: reatomAlbumForm({
      api,
      haptics: dependencies.telegram.haptics,
      closingConfirmation: dependencies.telegram,
      onSaved: (saved) => {
        navigation.isEditing.setFalse();
        navigation.openedId.set(saved.id);
        data.reload();
      },
    }),
    batch: reatomBatchUpload({
      ...dependencies,
      haptics: dependencies.telegram.haptics,
      upload: async (prepared) => api.uploadPhoto(prepared),
      addToAlbum: async (albumId, photo) => api.addPhotos(albumId, [photo.id]),
      onFinished: data.reload,
    }),
    viewer: reatomAlbumViewer(dependencies, { data, navigation, failure }),
  };
}

// The form opens over the screen it came from, which stays shown under it.
function reatomOpenForm({ isEditing }: Navigation, form: { isCreating: () => boolean }) {
  return {
    isFormOpen: readOnly(isEditing),
    formTitle: computed(() => (form.isCreating() ? "Новый альбом" : "Альбом"), "albums.formTitle"),
  };
}

function reatomOpening(navigation: Navigation, slide: Slide) {
  return {
    open: action((albumId: string) => {
      slide("forward", () => {
        navigation.openedId.set(albumId);
      });
    }, "albums.open"),
  };
}

export function reatomAlbumsScreen(dependencies: AlbumsDependencies) {
  const navigation: Navigation = {
    openedId: atom<string | undefined>(undefined, "albums.openedId"),
    isEditing: reatomBoolean(false, "albums.isEditing"),
  };
  const data = reatomAlbumsData({
    api: dependencies.api,
    openedId: navigation.openedId,
    liveVersion: dependencies.liveVersion,
    deviceCache: dependencies.deviceCache,
  });
  const failure = reatomRollbackFailure("albums.failure", dependencies.telegram.haptics);
  const parts = reatomParts(dependencies, { data, navigation, failure });
  const screen = reatomScreen(dependencies, { data, navigation });
  const remove = reatomRemoval(dependencies, { data, navigation, failure });

  return {
    screen,
    ...parts,
    photoHint: readOnly(dependencies.photoHint),
    canSetUpPhotos: readOnly(dependencies.canSetUpPhotos),
    setUpPhotos: action(() => {
      dependencies.onSetUpPhotos();
    }, "albums.setUpPhotos"),
    title: computed(() => titleOf(screen()), "albums.title"),
    ...reatomOpenForm(navigation, parts.form),
    ...reatomPlace({ data, navigation }),
    retry: data.reload,
    ...reatomOpening(navigation, dependencies.slide ?? instantly),
    openAll: action(() => {
      data.isAllShown.setTrue();
    }, "albums.openAll"),
    ...reatomMoves({ data, navigation, form: parts.form, batch: parts.batch }),
    back: reatomBack({ data, navigation, batch: parts.batch }, dependencies.telegram),
    failure: failure.failure,
    dismissFailure: failure.dismiss,
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
  };
}

function reatomBack(
  {
    data,
    navigation,
    batch,
  }: { data: AlbumsData; navigation: Navigation; batch: { dismiss: () => void } },
  telegram: AlbumsDependencies["telegram"],
) {
  return reatomFormBack({
    name: "albums.back",
    telegram,
    isFormOpen: navigation.isEditing,
    back: () => {
      if (navigation.isEditing()) {
        navigation.isEditing.setFalse();
      } else if (data.isAllShown()) {
        data.isAllShown.setFalse();
      } else {
        navigation.openedId.set(undefined);
        batch.dismiss();
      }
    },
  });
}

function titleOf(screen: AlbumsScreen): string {
  if (screen.kind === "album") {
    return screen.album.title;
  }

  return screen.kind === "all" ? "Все фото" : "Альбомы";
}

export type AlbumsScreenModel = ReturnType<typeof reatomAlbumsScreen>;
