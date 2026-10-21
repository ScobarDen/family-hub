import type { CSSProperties, ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "./ui.lib.ts";

export type ChartConfig = Record<string, { label: string; color: string }>;

type ChartContainerProps = { config: ChartConfig; className?: string; children: ReactElement };

// The shadcn chart frame: each series' colour becomes --color-<key> for the Recharts marks.
export function ChartContainer({ config, className, children }: ChartContainerProps) {
  const style: Record<string, string> = Object.fromEntries(
    Object.entries(config).map(([key, { color }]) => [`--color-${key}`, color]),
  );

  return (
    <div
      data-slot="chart"
      className={cn(
        "aspect-video w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50",
        className,
      )}
      style={style satisfies CSSProperties}
    >
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}
