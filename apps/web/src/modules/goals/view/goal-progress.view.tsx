import type { CSSProperties } from "react";

import { IconBadge } from "@/common/ui";

import { goalIcons } from "../goals.config.ts";
import type { GoalDetails } from "../goals.lib.ts";

const lines = ["remaining", "hint", "status", "note"] as const;

// A custom property instead of an inline width, so @starting-style can still fill the bar from zero.
function progressOf(goal: GoalDetails): Record<string, string> {
  return { "--progress": `${goal.percent}%` };
}

export function GoalProgress({ goal }: { goal: GoalDetails }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <IconBadge icon={goalIcons[goal.icon]} tone={goal.color} />
        <span className="text-xl leading-tight font-semibold">{goal.subtitle}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Накоплено"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={goal.percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full w-(--progress) rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out motion-safe:starting:w-0"
          style={progressOf(goal) satisfies CSSProperties}
        />
      </div>
      {lines.map(
        (line) =>
          goal[line] !== undefined && (
            <span key={line} className="text-sm text-muted-foreground">
              {goal[line]}
            </span>
          ),
      )}
    </div>
  );
}
