import { reatomComponent } from "@reatom/react";
import { Images } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { CareBlockProps } from "./expenses-block.view.tsx";
import { PhotoThumbs } from "./photo-thumbs.view.tsx";
import { PhotoViewer } from "./photo-viewer.view.tsx";

// The «Фото» block of the pet card: every photo of the Pet's entries, and the viewer over them.
export const PhotosBlock = reatomComponent(({ model }: CareBlockProps) => {
  const photos = model.petPhotos();

  return (
    <>
      <Section title="Фото" footer={model.photoHint()}>
        {photos.length === 0 ? (
          <SectionItem icon={Images} tone="violet" title="Фото пока нет — добавьте их к записи" />
        ) : (
          <div className="pt-3">
            <PhotoThumbs
              photos={photos}
              onOpen={(photoId) => {
                model.viewer.open(photos, photoId);
              }}
            />
          </div>
        )}
      </Section>
      <PhotoViewer model={model.viewer} canMakeAvatar={!model.isReadOnly()} />
    </>
  );
}, "PhotosBlock");
