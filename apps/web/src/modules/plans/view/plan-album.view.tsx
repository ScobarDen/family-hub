import { Images } from "lucide-react";

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
      {album.photos.length > 0 && (
        <div className="flex gap-1 overflow-x-auto px-4 pt-3 pb-2">
          {album.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="size-20 shrink-0 overflow-hidden rounded-md bg-muted"
              aria-label="Открыть альбом"
              onClick={open}
            >
              <img
                src={photo.urls.thumb}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <SectionItem
        icon={Images}
        tone="violet"
        title="Открыть альбом"
        subtitle={`${album.photoCount} фото`}
        onClick={open}
      />
    </Section>
  );
}
