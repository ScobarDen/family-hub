import { Children, useState, type ReactNode } from "react";

import { hasSlid } from "./ui.lib.ts";

type RevealedProps = {
  isSkeleton: boolean;
  entrance?: "fade" | "stagger";
  children: ReactNode;
};

const staggerMs = 100;

// Skeletons are aria-hidden, so the one hidden line is what a screen reader finds while loading.
// Content that replaces a skeleton at launch comes in gently; content already at hand from the device
// cache or an earlier visit, or loaded after the Member has moved on, shows at once.
export function Revealed({ isSkeleton, entrance = "fade", children }: RevealedProps) {
  const [hadSkeleton, setHadSkeleton] = useState(isSkeleton);

  if (isSkeleton && !hadSkeleton) {
    setHadSkeleton(true);
  }

  if (isSkeleton) {
    return (
      <>
        <span className="sr-only">Загружаем…</span>
        {children}
      </>
    );
  }

  if (!hadSkeleton || hasSlid()) {
    return children;
  }

  if (entrance === "fade") {
    return <div className="animate-fade-in">{children}</div>;
  }

  return Children.map(children, (child, index) => (
    <div
      className="motion-safe:animate-rise-in motion-reduce:animate-fade-in"
      style={{ animationDelay: `${index * staggerMs}ms` }}
    >
      {child}
    </div>
  ));
}
