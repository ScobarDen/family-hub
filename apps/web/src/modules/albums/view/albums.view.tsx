import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import { LoadState } from "@/common/ui";

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
    return (
      <>
        <PhotoThumbs
          className="grid grid-cols-3 gap-0.5 px-4 pb-4"
          thumbClassName="aspect-square"
          photos={screen.photos}
          onOpen={(photoId) => {
            model.viewer.open(screen.photos, photoId);
          }}
        />
        <PhotoViewer model={model.viewer} />
      </>
    );
  }

  if (screen.kind === "form") {
    return <AlbumForm model={model.form} onCancel={model.back} />;
  }

  return (
    <LoadState
      failure={screen.kind === "failed" ? "Не получилось загрузить альбомы." : undefined}
    />
  );
}

export const Albums = reatomComponent(
  ({ model }: AlbumsProps) => contentOf(model, model.screen()),
  "Albums",
);
