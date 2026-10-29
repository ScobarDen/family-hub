import type { ReactNode } from "react";

import { Skeleton } from "./skeleton.view.tsx";

const summaryLine = (
  <div className="box-content flex h-lh items-center text-subhead px-5 pb-4">
    <Skeleton className="h-3.5 w-32" />
  </div>
);

export function SkeletonSectionLayout({
  summary = summaryLine,
  tabs,
  children,
}: {
  summary?: ReactNode;
  tabs: number;
  children: ReactNode;
}) {
  return (
    <>
      {summary}
      <div className="px-4 pb-5">
        <Skeleton className="h-11 rounded-lg" />
      </div>
      {tabs > 1 && (
        <div className="flex gap-1.5 px-4 pb-4">
          {Array.from({ length: tabs }, (_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      )}
      {children}
    </>
  );
}
