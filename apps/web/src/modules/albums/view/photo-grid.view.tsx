import type { Photo } from "@family-hub/contract";

type PhotoGridProps = { photos: Photo[]; onOpen: (photoId: string) => void };

// Three across, as Telegram shows a chat's media.
export function PhotoGrid({ photos, onOpen }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-3 gap-0.5 px-4 pb-4">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          className="aspect-square overflow-hidden bg-muted"
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
