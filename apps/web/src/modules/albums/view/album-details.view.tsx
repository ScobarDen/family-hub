import { reatomComponent } from "@reatom/react";
import { ImagePlus, ImageUp, Pencil, Trash2 } from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import { FilePick, Section, SectionItem } from "@/common/ui";

import type { AlbumView } from "../albums.lib.ts";
import type { AlbumsScreenModel } from "../vm/albums.vm.ts";
import { UploadProgress } from "./upload-progress.view.tsx";

type DetailsProps = { album: AlbumView; model: AlbumsScreenModel };

const coverAction = { label: "Сделать обложкой", icon: ImageUp };

export const AlbumDetails = reatomComponent(({ album, model }: DetailsProps) => {
  const hint = model.photoHint();

  return (
    <>
      <Section footer={hint ?? album.description ?? undefined}>
        <SectionItem title={album.subtitle} />
        {hint === undefined && (
          <FilePick
            className="flex min-h-11 items-center gap-3 border-t px-4 text-primary"
            onPick={model.upload}
          >
            <ImagePlus className="size-5" />
            Добавить фото
          </FilePick>
        )}
        {album.canEdit && (
          <SectionItem icon={Pencil} title="Изменить альбом" onClick={model.edit} />
        )}
        {album.canDelete && (
          <SectionItem icon={Trash2} isAlert title="Удалить альбом" onClick={model.remove} />
        )}
      </Section>
      <UploadProgress model={model.batch} />
      <PhotoThumbs
        className="grid grid-cols-3 gap-0.5 px-4 pb-4"
        thumbClassName="aspect-square"
        photos={album.photos}
        onOpen={(photoId) => {
          model.viewer.open(album.photos, photoId);
        }}
      />
      <PhotoViewer model={model.viewer} pickAction={album.canEdit ? coverAction : undefined} />
    </>
  );
}, "AlbumDetails");
