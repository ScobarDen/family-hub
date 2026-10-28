import { reatomComponent } from "@reatom/react";

import { sectionColors, sectionIcons } from "@/common/sections";
import { cn, RoundPicture } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";

// The section's colour sits on its icon only, over the neutral card of either theme. The tile is
// square and holds no note (that goes to «Разделы»); an Overdue Task turns its number red.
export const Tiles = reatomComponent(
  ({ model }: { model: TodayModel }) => (
    <section aria-label="Разделы" className="grid grid-cols-3 gap-2 px-4 pb-7">
      {model.tiles().map(({ module, title, value, valueLabel, isAlert, picture }) => {
        const Icon = sectionIcons[module];
        const icon = (
          <Icon className={cn("size-5", sectionColors[module])} strokeWidth={1.75} aria-hidden />
        );

        return (
          <button
            key={module}
            type="button"
            className="flex aspect-square min-w-0 flex-col items-start gap-1 rounded-2xl bg-card p-3 text-left text-card-foreground active:bg-muted press"
            onClick={() => {
              model.openTile(module);
            }}
          >
            {picture === undefined ? icon : <RoundPicture src={picture} fallback={icon} />}
            <span className="w-full text-footnote font-medium break-words hyphens-auto">
              {title}
            </span>
            {valueLabel !== undefined && <span className="sr-only">{valueLabel}</span>}
            <span
              aria-hidden={value === undefined || valueLabel !== undefined}
              className={cn(
                "text-value leading-none font-semibold",
                isAlert ? "text-destructive-text" : value === undefined && "text-muted-foreground",
              )}
            >
              {value ?? "—"}
            </span>
          </button>
        );
      })}
    </section>
  ),
  "Tiles",
);
