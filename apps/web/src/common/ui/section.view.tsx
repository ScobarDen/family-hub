import type { ReactNode } from "react";

type SectionProps = {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Section({ title, footer, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-1.5 px-4 pb-6">
      {title !== undefined && (
        <h2 className="px-4 text-[0.8rem] font-medium text-muted-foreground uppercase ios:normal-case ios:text-sm">
          {title}
        </h2>
      )}
      <div className="flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground android:rounded-2xl">
        {children}
      </div>
      {footer !== undefined && <div className="px-4 text-sm text-muted-foreground">{footer}</div>}
    </section>
  );
}
