import { reatomComponent } from "@reatom/react";
import { Images, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { PhotoViewer } from "@/common/photo-viewer";
import { Section, SectionItem } from "@/common/ui";

import type { AlbumsScreen, AlbumsScreenModel } from "../vm/albums.vm.ts";
import { AlbumDetails } from "./album-details.view.tsx";
import { AlbumForm } from "./album-form.view.tsx";
import { AlbumList } from "./album-list.view.tsx";
import { PhotoGrid } from "./photo-grid.view.tsx";

export type AlbumsProps = { model: AlbumsScreenModel };

function contentOf(model: AlbumsScreenModel, screen: AlbumsScreen): ReactNode {
  if (screen.kind === "list") {
    return <AlbumList model={model} albums={screen.albums} />;
  }

  if (screen.kind === "album") {
    return <AlbumDetails album={screen.album} model={model} />;
  }

  if (screen.kind === "all") {
    return (
      <>
        <PhotoGrid
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
    <Section>
      <SectionItem
        icon={screen.kind === "loading" ? Images : Plus}
        tone="violet"
        title={screen.kind === "loading" ? "Загружаем…" : "Не получилось загрузить альбомы."}
      />
    </Section>
  );
}

export const Albums = reatomComponent(
  ({ model }: AlbumsProps) => contentOf(model, model.screen()),
  "Albums",
);
