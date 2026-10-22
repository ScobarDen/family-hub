import { Images } from "lucide-react";

import { PhotoThumbs } from "@/common/photo-viewer";
import { Section, SectionItem } from "@/common/ui";

import type { PlanDetails } from "../plans.lib.ts";

type PlanAlbumProps = {
  album: NonNullable<PlanDetails["album"]>;
  onOpen: (albumId: string) => void;
};

// The trip's photos at a glance; the Album itself lives in the albums tab.
export function PlanAlbum({ album, onOpen }: PlanAlbumProps) {
  function open() {
    onOpen(album.id);
  }

  return (
    <Section title={album.title}>
      <PhotoThumbs
        photos={album.photos}
        className="flex gap-1 overflow-x-auto px-4 pt-3 pb-2"
        thumbClassName="size-20 rounded-md"
        label="Открыть альбом"
        onOpen={open}
      />
      <SectionItem
        icon={Images}
        title="Открыть альбом"
        subtitle={`${album.photoCount} фото`}
        onClick={open}
      />
    </Section>
  );
}
