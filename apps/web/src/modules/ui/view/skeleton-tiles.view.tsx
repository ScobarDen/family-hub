import { Skeleton } from "./skeleton.view.tsx";

export function SkeletonTiles({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pb-7">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="aspect-square rounded-2xl" />
      ))}
    </div>
  );
}
