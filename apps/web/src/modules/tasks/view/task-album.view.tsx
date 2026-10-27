import { Images } from "lucide-react";

import { PhotoThumbs } from "@/common/photo-viewer";
import { Section, SectionItem } from "@/common/ui";

import type { TaskDetails } from "../task-details.lib.ts";

type TaskAlbumProps = {
  album: NonNullable<TaskDetails["album"]>;
  onOpen: (albumId: string) => void;
};

// The trip's photos at a glance; the Album itself lives in the albums tab.
export function TaskAlbum({ album, onOpen }: TaskAlbumProps) {
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
