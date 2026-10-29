import type { Photo } from "@family-hub/contract";

import { SignedPhoto } from "@/modules/photo";
import { cn } from "@/modules/ui";

type PhotoThumbsProps = {
  photos: Photo[];
  onOpen: (photoId: string) => void;
  // The strip's own layout and the size of one thumb.
  className: string;
  thumbClassName: string;
  // One name for every thumb when they all do the same, such as opening the Album.
  label?: string;
  // Photos left out of the strip, shown as «+N» over the last one.
  more?: number;
  resolution?: "thumb" | "medium";
};

function thumbName(position: number, shown: number, more: number): string {
  const name = `Открыть фото ${position} из ${shown + more}`;

  return position === shown && more > 0 ? `${name}, ещё ${more} фото` : name;
}

export function PhotoThumbs({
  photos,
  onOpen,
  className,
  thumbClassName,
  label,
  more = 0,
  resolution = "thumb",
}: PhotoThumbsProps) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          className={cn("relative shrink-0 overflow-hidden bg-muted", thumbClassName)}
          aria-label={label ?? thumbName(index + 1, photos.length, more)}
          onClick={() => {
            onOpen(photo.id);
          }}
        >
          <SignedPhoto
            src={photo.urls[resolution]}
            loading="lazy"
            className="size-full rounded-[inherit] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          />
          {index === photos.length - 1 && more > 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
              +{more}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
