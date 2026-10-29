import type { ReactNode } from "react";

import { cn } from "../ui.lib.ts";
import { FallbackImage } from "./fallback-image.view.tsx";

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
  return (
    <FallbackImage
      src={src}
      fallback={fallback}
      className={cn(
        "size-7 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10",
        className,
      )}
    />
  );
}
