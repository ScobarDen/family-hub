import { ImageOff } from "lucide-react";
import { useState, type ReactNode } from "react";

type FallbackImageProps = {
  src: string;
  className: string;
  alt?: string;
  loading?: "lazy";
  fallback?: ReactNode;
};

// A signed link kept in the device cache may have expired: the placeholder takes the image's box, so nothing shifts.
export function FallbackImage({ src, className, alt = "", loading, fallback }: FallbackImageProps) {
  const [failedSource, setFailedSource] = useState<string>();

  if (failedSource === src) {
    return fallback === undefined ? (
      <span
        role={alt === "" ? undefined : "img"}
        aria-label={alt === "" ? undefined : alt}
        aria-hidden={alt === "" ? true : undefined}
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}
      >
        <ImageOff aria-hidden className="size-1/3 max-h-8 max-w-8" />
      </span>
    ) : (
      fallback
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      loading={loading}
      className={className}
      onError={() => {
        setFailedSource(src);
      }}
    />
  );
}
