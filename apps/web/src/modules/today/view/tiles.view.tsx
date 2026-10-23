import { reatomComponent } from "@reatom/react";

import { sectionColors, sectionIcons } from "@/common/sections";
import { cn } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";

// The section's colour sits on its icon only, over the neutral card of either theme. A note wraps
// whole, so an Overdue Due Date is read to its end; a section with nothing to count shows a dash.
export const Tiles = reatomComponent(
  ({ model }: { model: TodayModel }) => (
    <section aria-label="Разделы" className="grid grid-cols-3 gap-2 px-4 pb-7">
      {model.tiles().map(({ module, title, value, note, isAlert }) => {
        const Icon = sectionIcons[module];

        return (
          <button
            key={module}
            type="button"
            className="flex min-h-24 min-w-0 flex-col items-start gap-1 rounded-2xl bg-card p-3 text-left text-card-foreground active:bg-muted"
            onClick={() => {
              model.openTile(module);
            }}
          >
            <Icon className={cn("size-5", sectionColors[module])} strokeWidth={1.75} aria-hidden />
            <span className="w-full text-[0.8125rem] font-medium break-words hyphens-auto">
              {title}
            </span>
            {value !== undefined && (
              <span className="text-xl leading-none font-semibold">{value}</span>
            )}
            {value === undefined && note === undefined && (
              <span className="text-muted-foreground" aria-hidden>
                —
              </span>
            )}
            {note !== undefined && (
              <span
                className={cn(
                  "text-[0.8125rem] break-words",
                  isAlert ? "text-destructive-text" : "text-muted-foreground",
                )}
              >
                {note}
              </span>
            )}
          </button>
        );
      })}
    </section>
  ),
  "Tiles",
);
