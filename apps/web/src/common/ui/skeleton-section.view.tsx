import { sectionRowClass } from "./section-item.view.tsx";
import { Section } from "./section.view.tsx";
import { Skeleton } from "./skeleton.view.tsx";

export function SkeletonSection({ title, rows }: { title?: string; rows: number }) {
  return (
    <Section {...(title === undefined ? {} : { title })}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={sectionRowClass}>
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <span
            data-slot="item-body"
            className="flex min-h-12 flex-1 flex-col justify-center gap-0.5 border-border py-2.5 pr-4"
          >
            <span className="flex h-[1.375rem] items-center">
              <Skeleton className="h-3.5 w-3/5" />
            </span>
            <span className="flex h-[calc(0.8125rem*1.375)] items-center">
              <Skeleton className="h-3 w-2/5" />
            </span>
          </span>
        </div>
      ))}
    </Section>
  );
}
