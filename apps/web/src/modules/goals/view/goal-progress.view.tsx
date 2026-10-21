import { IconBadge } from "@/common/ui";

import { goalIcons } from "../goals.config.ts";
import type { GoalDetails } from "../goals.lib.ts";

export function GoalProgress({ goal }: { goal: GoalDetails }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <IconBadge icon={goalIcons[goal.icon]} tone={goal.color} />
        <span className="text-lg font-semibold">{goal.subtitle}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${goal.percent}%` }} />
      </div>
      {[goal.remaining, goal.hint, goal.status, goal.note]
        .filter((line) => line !== undefined)
        .map((line) => (
          <span key={line} className="text-sm text-muted-foreground">
            {line}
          </span>
        ))}
    </div>
  );
}
