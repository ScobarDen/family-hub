import { BellRing, Repeat } from "lucide-react";

import { PersonAvatar, RoundPicture } from "@/common/ui";

import type { TaskRow } from "../task-rows.lib.ts";

export function TaskMarks({ row }: { row: TaskRow }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
      {row.isRecurring && <Repeat role="img" aria-label="Повторяется" className="size-4" />}
      {row.hasReminder && <BellRing role="img" aria-label="С напоминанием" className="size-4" />}
      {row.petPicture !== undefined && (
        <RoundPicture src={row.petPicture} fallback={null} className="size-6" />
      )}
      {row.assigneesLabel !== undefined && (
        <span role="img" aria-label={row.assigneesLabel} className="flex -space-x-2">
          {row.assignees.map((person) => (
            <PersonAvatar key={person.id} member={person} className="size-6 ring-2 ring-card" />
          ))}
        </span>
      )}
    </span>
  );
}
