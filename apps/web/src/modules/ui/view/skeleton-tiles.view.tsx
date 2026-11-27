import { Skeleton } from "./skeleton.view.tsx";

export const tileGridClass = "grid grid-cols-3 gap-2 px-4 pb-7 lg:grid-cols-2 xl:grid-cols-3";

export function SkeletonTiles({ count }: { count: number }) {
  return (
    <div className={tileGridClass}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="aspect-square rounded-2xl" />
      ))}
    </div>
  );
}
