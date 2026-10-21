import type { Photo } from "@family-hub/contract";

type RecipePhotosProps = { photos: Photo[]; onOpen: (photoId: string) => void };

export function RecipePhotos({ photos, onOpen }: RecipePhotosProps) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 overflow-x-auto px-4 pb-3">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          className="size-28 shrink-0 overflow-hidden rounded-lg bg-muted"
          aria-label="Открыть фото"
          onClick={() => {
            onOpen(photo.id);
          }}
        >
          <img src={photo.urls.medium} alt="" className="size-full object-cover" />
        </button>
      ))}
    </div>
  );
}
