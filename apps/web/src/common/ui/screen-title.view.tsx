type ScreenTitleProps = {
  title: string;
  subtitle?: string;
};

export function ScreenTitle({ title, subtitle }: ScreenTitleProps) {
  return (
    <header className="flex flex-col gap-1 px-5 pt-6 pb-5">
      {/* The app moves focus here on each new screen, so a screen reader hears where it is. */}
      <h1
        tabIndex={-1}
        className="text-[1.625rem] leading-tight font-semibold tracking-tight break-words"
      >
        {title}
      </h1>
      {subtitle !== undefined && (
        <p className="text-[0.9375rem] text-muted-foreground">{subtitle}</p>
      )}
    </header>
  );
}
