import { Children, useState, type ReactNode } from "react";

type RevealedProps = {
  isSkeleton: boolean;
  // A stagger brings each child in 100 ms after the one before it.
  entrance?: "fade" | "stagger";
  children: ReactNode;
};

const staggerMs = 100;

// Content that replaces a skeleton comes in gently; content already at hand from the device cache
// or an earlier visit shows at once.
export function Revealed({ isSkeleton, entrance = "fade", children }: RevealedProps) {
  const [hadSkeleton, setHadSkeleton] = useState(isSkeleton);

  if (isSkeleton && !hadSkeleton) {
    setHadSkeleton(true);
  }

  if (isSkeleton || !hadSkeleton) {
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
