import { Images, Plus } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { AlbumItem } from "../albums.lib.ts";
import type { AlbumsScreenModel } from "../vm/albums.vm.ts";

type AlbumListProps = { model: AlbumsScreenModel; albums: AlbumItem[] };

export function AlbumList({ model, albums }: AlbumListProps) {
  return (
    <>
      <Section>
        <SectionItem icon={Images} title="Все фото" onClick={model.openAll} />
      </Section>
      <Section title="Альбомы">
        {albums.map((album) => (
          <SectionItem
            key={album.id}
            title={album.title}
            subtitle={album.subtitle}
            after={
              album.cover === undefined ? (
                <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
                  <Images className="size-5 text-muted-foreground" />
                </span>
              ) : (
                <img src={album.cover} alt="" className="size-12 rounded-lg object-cover" />
              )
            }
            onClick={() => {
              model.open(album.id);
            }}
          />
        ))}
        <SectionItem icon={Plus} title="Новый альбом" onClick={model.add} />
      </Section>
    </>
  );
}
