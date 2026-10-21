import { reatomComponent } from "@reatom/react";
import { ImagePlus, ImageUp, Pencil, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";

import { PhotoViewer } from "@/common/photo-viewer";
import { Section, SectionItem } from "@/common/ui";

import type { AlbumView } from "../albums.lib.ts";
import type { AlbumsScreenModel } from "../vm/albums.vm.ts";
import { PhotoGrid } from "./photo-grid.view.tsx";
import { UploadProgress } from "./upload-progress.view.tsx";

type DetailsProps = { album: AlbumView; model: AlbumsScreenModel };

const coverAction = { label: "Сделать обложкой", icon: ImageUp };

export const AlbumDetails = reatomComponent(({ album, model }: DetailsProps) => {
  const hint = model.photoHint();

  function pick(event: ChangeEvent<HTMLInputElement>) {
    model.upload([...(event.target.files ?? [])]);
    event.target.value = "";
  }

  return (
    <>
      <Section footer={hint ?? album.description ?? undefined}>
        <SectionItem title={album.subtitle} />
        {hint === undefined && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t px-4 text-primary">
            <ImagePlus className="size-5" />
            Добавить фото
            <input type="file" accept="image/*" multiple className="hidden" onChange={pick} />
          </label>
        )}
        {album.canEdit && (
          <SectionItem icon={Pencil} tone="gray" title="Изменить альбом" onClick={model.edit} />
        )}
        {album.canDelete && (
          <SectionItem icon={Trash2} tone="red" title="Удалить альбом" onClick={model.remove} />
        )}
      </Section>
      <UploadProgress model={model.batch} />
      <PhotoGrid
        photos={album.photos}
        onOpen={(photoId) => {
          model.viewer.open(album.photos, photoId);
        }}
      />
      <PhotoViewer model={model.viewer} pickAction={album.canEdit ? coverAction : undefined} />
    </>
  );
}, "AlbumDetails");
