type ScreenTitleProps = {
  title: string;
  subtitle?: string;
};

export function ScreenTitle({ title, subtitle }: ScreenTitleProps) {
  return (
    <header className="flex flex-col gap-1 px-4 pt-6 pb-4">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle !== undefined && <p className="text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
