import { reatomComponent } from "@reatom/react";
import { Scale } from "lucide-react";

import { Button } from "@/common/ui";

import type { CareBlockProps } from "./expenses-block.view.tsx";

// The last weighing leads the block; the chart under it is the evidence.
export const WeightHeader = reatomComponent(({ model }: CareBlockProps) => {
  const summary = model.weightSummary();

  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[1.75rem] leading-none tracking-tight">{summary?.latest ?? "—"}</span>
        <span className="text-[0.8125rem] text-muted-foreground">
          {summary?.change ?? "Последнее взвешивание"}
        </span>
      </div>
      {!model.isReadOnly() && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            model.add("weight");
          }}
        >
          <Scale /> Записать
        </Button>
      )}
    </div>
  );
}, "WeightHeader");
