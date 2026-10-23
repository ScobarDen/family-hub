import { useState, type ReactNode } from "react";

import { cn } from "./ui.lib.ts";

// A picture that fails to load gives its place back to what stood there without it.
export function RoundPicture({
  src,
  fallback,
  className,
}: {
  src: string;
  fallback: ReactNode;
  className?: string;
}) {
  const [failedPicture, setFailedPicture] = useState<string>();

  if (failedPicture === src) {
    return fallback;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={cn("size-7 shrink-0 rounded-full object-cover", className)}
      onError={() => {
        setFailedPicture(src);
      }}
    />
  );
}
