import type { ReactNode } from "react";

type SectionProps = {
  title?: string;
  // A short figure or link at the header's right end: a count, a total, «Все».
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function Section({ title, aside, footer, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-2 px-4 pb-7">
      {(title !== undefined || aside !== undefined) && (
        <div className="flex items-baseline justify-between gap-3 px-1">
          {title !== undefined && (
            <h2 className="text-subhead font-semibold tracking-tight">{title}</h2>
          )}
          {aside !== undefined && (
            <span className="text-footnote text-muted-foreground">{aside}</span>
          )}
        </div>
      )}
      <div className="flex flex-col overflow-hidden rounded-2xl bg-card text-card-foreground">
        {children}
      </div>
      {footer !== undefined && (
        <div className="px-1 text-footnote text-muted-foreground">{footer}</div>
      )}
    </section>
  );
}
