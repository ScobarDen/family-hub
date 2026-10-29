import { reatomComponent } from "@reatom/react";
import { Images, UserRound } from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/modules/photo-viewer";
import { Section, SectionItem } from "@/modules/ui";

import type { CareModel } from "../vm/care.vm.ts";

const avatarAction = { label: "Сделать аватаром", icon: UserRound };

// The «Фото» block of the pet card: every photo of the Pet's entries, and the viewer over them.
export const PhotosBlock = reatomComponent(({ model }: { model: CareModel }) => {
  const photos = model.petPhotos();

  return (
    <>
      <Section title="Фото" footer={model.photoHint()}>
        {photos.length === 0 ? (
          <SectionItem icon={Images} title="Фото пока нет — добавьте их к записи" />
        ) : (
          <div className="pt-3">
            <PhotoThumbs
              className="flex flex-wrap gap-1 px-4 pb-2"
              thumbClassName="size-16 rounded-md"
              photos={photos}
              onOpen={(photoId) => {
                model.viewer.open(photos, photoId);
              }}
            />
          </div>
        )}
      </Section>
      <PhotoViewer
        model={model.viewer}
        pickAction={model.isReadOnly() ? undefined : avatarAction}
      />
    </>
  );
}, "PhotosBlock");
