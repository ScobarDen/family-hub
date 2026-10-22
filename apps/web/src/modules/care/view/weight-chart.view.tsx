import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/common/ui";

import type { WeightPoint } from "../care.lib.ts";

const config: ChartConfig = { kg: { label: "Вес", color: "var(--primary)" } };

// The axis steps by half a kilogram, so its ticks are round and the line never touches the edge.
const tickStep = 0.5;

function ticksOf(points: WeightPoint[]): number[] {
  const weights = points.map(({ kg }) => kg);
  const low = Math.floor(Math.min(...weights) / tickStep);
  const high = Math.ceil(Math.max(...weights) / tickStep);

  return Array.from({ length: high - low + 1 }, (_, index) => (low + index) * tickStep);
}

function formatTick(kg: number): string {
  return kg.toLocaleString("ru-RU");
}

export function WeightChart({ points }: { points: WeightPoint[] }) {
  const ticks = ticksOf(points);

  return (
    <ChartContainer config={config} className="aspect-[2/1] py-3 pr-4 pl-2">
      <LineChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={32} />
        <YAxis
          dataKey="kg"
          width={40}
          tickLine={false}
          axisLine={false}
          ticks={ticks}
          domain={[ticks.at(0) ?? "auto", ticks.at(-1) ?? "auto"]}
          tickFormatter={formatTick}
        />
        <Line dataKey="kg" type="linear" stroke="var(--color-kg)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
