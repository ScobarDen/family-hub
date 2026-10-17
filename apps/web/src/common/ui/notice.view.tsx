import type { ReactNode } from "react";

type NoticeProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function Notice({ title, description, children }: NoticeProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 pt-safe-top pb-safe-bottom text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description !== undefined && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </main>
  );
}
