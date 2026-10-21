import type { FeedRow } from "../feed.lib.ts";
import type { FeedModel } from "../vm/feed.vm.ts";

// Up to three thumbnails under an Activity and «+N» for the rest; a tap opens them full screen.
export function FeedPhotos({ row, model }: { row: FeedRow; model: FeedModel }) {
  if (row.photos.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 pr-4 pb-2 pl-14">
      {row.photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          className="relative size-16 overflow-hidden rounded-md bg-muted"
          aria-label="Открыть фото"
          onClick={() => {
            model.viewer.open(row.photos, photo.id);
          }}
        >
          <img src={photo.urls.thumb} alt="" loading="lazy" className="size-full object-cover" />
          {index === row.photos.length - 1 && row.morePhotos > 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
              +{row.morePhotos}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
