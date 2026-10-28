import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import {
  FailureBar,
  LoadState,
  Revealed,
  SkeletonPhotoGrid,
  SkeletonSection,
  SkeletonSectionLayout,
} from "@/common/ui";

import type { AlbumsScreen, AlbumsScreenModel } from "../vm/albums.vm.ts";
import { AlbumDetails } from "./album-details.view.tsx";
import { AlbumForm } from "./album-form.view.tsx";
import { AlbumList } from "./album-list.view.tsx";

export type AlbumsProps = { model: AlbumsScreenModel };

function contentOf(model: AlbumsScreenModel, screen: AlbumsScreen): ReactNode {
  if (screen.kind === "list") {
    return <AlbumList model={model} albums={screen.albums} summary={screen.summary} />;
  }

  if (screen.kind === "album") {
    return <AlbumDetails album={screen.album} model={model} />;
  }

  if (screen.kind === "all") {
    const { photos } = screen;

    if (photos === undefined) {
      return <SkeletonPhotoGrid count={12} />;
    }

    return (
      <>
        <PhotoThumbs
          className="grid grid-cols-3 gap-0.5 px-4 pb-4"
          thumbClassName="aspect-square"
          photos={photos}
          onOpen={(photoId) => {
            model.viewer.open(photos, photoId);
          }}
        />
        <PhotoViewer model={model.viewer} />
      </>
    );
  }

  if (screen.kind === "form") {
    return <AlbumForm model={model.form} onCancel={model.back} />;
  }

  if (screen.kind === "loading") {
    return (
      <SkeletonSectionLayout tabs={1}>
        <SkeletonSection rows={1} />
        <SkeletonSection rows={3} />
      </SkeletonSectionLayout>
    );
  }

  return <LoadState failure="Не получилось загрузить альбомы." onRetry={model.retry} />;
}

export const Albums = reatomComponent(({ model }: AlbumsProps) => {
  const screen = model.screen();

  return (
    <>
      <Revealed isSkeleton={screen.kind === "loading"}>{contentOf(model, screen)}</Revealed>
      <FailureBar failure={model.failure()} onDismiss={model.dismissFailure} />
    </>
  );
}, "Albums");
