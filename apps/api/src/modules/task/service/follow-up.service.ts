import type { Membership } from "@/common/auth";

import type { TaskDependencies, TaskResult } from "../task.types.ts";
import { create } from "./task-root.service.ts";

export type FollowUp = { petId: string; title: string; date: string };

// «Повторить» on a Care Entry: a Pet-linked Task on that date with its author as Assignee, so a
// forgotten vaccination turns Overdue, nudging a week before and on the morning of the day.
export async function followUp(
  dependencies: TaskDependencies,
  membership: Membership,
  { petId, title, date }: FollowUp,
): Promise<TaskResult> {
  return create(dependencies, membership, {
    title,
    note: null,
    when: { date, time: null, timeZone: null, endDate: null, endTime: null },
    recurrence: null,
    assigneeIds: [membership.member.id],
    recipients: "default",
    reminderOffsets: ["1w", "at-start"],
    visibility: "shared",
    petId,
    albumId: null,
  });
}
