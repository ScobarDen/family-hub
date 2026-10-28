import { Images } from "lucide-react";

import { SignedPhoto } from "@/common/photo";
import { PrimaryButton, Section, SectionItem, SectionLayout } from "@/common/ui";

import type { AlbumItem } from "../albums.lib.ts";
import type { AlbumsScreenModel } from "../vm/albums.vm.ts";

type AlbumListProps = { model: AlbumsScreenModel; albums: AlbumItem[]; summary: string };

function albumsOf({ model, albums }: AlbumListProps) {
  return (
    <>
      <Section>
        <SectionItem icon={Images} title="Все фото" onClick={model.openAll} />
      </Section>
      {albums.length > 0 && (
        <Section>
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
                  <SignedPhoto
                    src={album.cover}
                    className="size-12 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                  />
                )
              }
              onClick={() => {
                model.open(album.id);
              }}
            />
          ))}
        </Section>
      )}
    </>
  );
}

export function AlbumList(props: AlbumListProps) {
  return (
    <SectionLayout
      summary={<p className="px-5 pb-4 text-subhead text-muted-foreground">{props.summary}</p>}
      action={<PrimaryButton onClick={props.model.add}>Создать альбом</PrimaryButton>}
      tabs={[{ key: "albums", title: "Альбомы", content: albumsOf(props) }]}
    />
  );
}
