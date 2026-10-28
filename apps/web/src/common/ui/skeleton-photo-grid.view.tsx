import { Skeleton } from "./skeleton.view.tsx";

export function SkeletonPhotoGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-3 gap-0.5 px-4 pb-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="aspect-square rounded-none" />
      ))}
    </div>
  );
}
