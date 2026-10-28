import type { Photo } from "@family-hub/contract";

import { SignedPhoto } from "@/common/photo";
import { cn } from "@/common/ui";

type PhotoThumbsProps = {
  photos: Photo[];
  onOpen: (photoId: string) => void;
  // The strip's own layout and the size of one thumb.
  className: string;
  thumbClassName: string;
  label?: string;
  // Photos left out of the strip, shown as «+N» over the last one.
  more?: number;
  resolution?: "thumb" | "medium";
};

export function PhotoThumbs({
  photos,
  onOpen,
  className,
  thumbClassName,
  label = "Открыть фото",
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
          aria-label={label}
          onClick={() => {
            onOpen(photo.id);
          }}
        >
          <SignedPhoto
            src={photo.urls[resolution]}
            loading="lazy"
            className="size-full object-cover"
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
