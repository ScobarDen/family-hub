import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/common/ui";

import type { WeightPoint } from "../care.lib.ts";

const config: ChartConfig = { kg: { label: "Вес", color: "var(--primary)" } };

export function WeightChart({ points }: { points: WeightPoint[] }) {
  return (
    <ChartContainer config={config} className="px-2 py-3">
      <LineChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          dataKey="kg"
          width={32}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
        />
        <Line dataKey="kg" type="monotone" stroke="var(--color-kg)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
