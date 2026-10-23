import { reatomComponent } from "@reatom/react";
import { ImagePlus, ImageUp, Pencil, Trash2 } from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import { FilePick, Section, SectionItem, SectionLayout } from "@/common/ui";

import type { AlbumView } from "../albums.lib.ts";
import type { AlbumsScreenModel } from "../vm/albums.vm.ts";
import { UploadProgress } from "./upload-progress.view.tsx";

type DetailsProps = { album: AlbumView; model: AlbumsScreenModel };

const coverAction = { label: "Сделать обложкой", icon: ImageUp };

// Without Photo Storage the hint takes the button's place and says why.
function summaryOf({ album }: DetailsProps, hint: string | undefined) {
  return (
    <div className="flex flex-col gap-1 px-5 pb-4 text-[0.9375rem]">
      <span>{album.subtitle}</span>
      {album.description !== null && (
        <span className="text-muted-foreground">{album.description}</span>
      )}
      {hint !== undefined && <span className="text-muted-foreground">{hint}</span>}
    </div>
  );
}

function photosOf({ album, model }: DetailsProps) {
  return (
    <>
      <UploadProgress model={model.batch} />
      <PhotoThumbs
        className="grid grid-cols-3 gap-0.5 px-4 pb-4"
        thumbClassName="aspect-square"
        photos={album.photos}
        onOpen={(photoId) => {
          model.viewer.open(album.photos, photoId);
        }}
      />
    </>
  );
}

function managementOf({ album, model }: DetailsProps) {
  return (
    (album.canEdit || album.canDelete) && (
      <Section>
        {album.canEdit && (
          <SectionItem icon={Pencil} title="Изменить альбом" onClick={model.edit} />
        )}
        {album.canDelete && (
          <SectionItem icon={Trash2} isAlert title="Удалить альбом" onClick={model.remove} />
        )}
      </Section>
    )
  );
}

export const AlbumDetails = reatomComponent((props: DetailsProps) => {
  const { album, model } = props;
  const hint = model.photoHint();

  return (
    <>
      <SectionLayout
        summary={summaryOf(props, hint)}
        action={
          hint === undefined ? (
            <FilePick
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground"
              onPick={model.upload}
            >
              <ImagePlus className="size-5" aria-hidden />
              Добавить фото
            </FilePick>
          ) : undefined
        }
        tabs={[{ key: "photos", title: "Фото", content: photosOf(props) }]}
      />
      {managementOf(props)}
      <PhotoViewer model={model.viewer} pickAction={album.canEdit ? coverAction : undefined} />
    </>
  );
}, "AlbumDetails");
