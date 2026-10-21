import type { Photo } from "@family-hub/contract";

type PhotoThumbsProps = { photos: Photo[]; onOpen: (photoId: string) => void };

export function PhotoThumbs({ photos, onOpen }: PhotoThumbsProps) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 px-4 pb-2">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          className="size-16 overflow-hidden rounded-md bg-muted"
          aria-label="Открыть фото"
          onClick={() => {
            onOpen(photo.id);
          }}
        >
          <img src={photo.urls.thumb} alt="" loading="lazy" className="size-full object-cover" />
        </button>
      ))}
    </div>
  );
}
