import type { Membership } from "@/common/auth";
import { httpStatus } from "@/common/errors";
import { BotApiError } from "@/common/telegram";

import { assignedText, openTaskButton } from "../task.lib.ts";
import type { TaskDependencies } from "../task.types.ts";

type AssignmentChange = {
  taskId: string;
  title: string;
  date: string | null;
  assigneeIds: string[];
  previousAssigneeIds: string[];
};

async function send(
  { bot, appLinks, memberships, clock }: TaskDependencies,
  assignee: Membership,
  { text, taskId }: { text: string; taskId: string },
): Promise<void> {
  try {
    const url = await appLinks.appLink({ kind: "task", id: taskId });

    await bot.call("sendMessage", {
      chat_id: assignee.member.telegramId,
      text,
      reply_markup: openTaskButton(url),
    });
  } catch (error) {
    if (!(error instanceof BotApiError)) {
      throw error;
    }

    if (error.errorCode === httpStatus.forbidden) {
      await memberships.setCanMessage(assignee.member.id, false, clock.now());
    }
  }
}

// Only someone else's choice is news: assigning oneself or keeping an Assignee stays quiet.
export async function notifyAssignees(
  dependencies: TaskDependencies,
  membership: Membership,
  change: AssignmentChange,
): Promise<void> {
  const added = change.assigneeIds.filter(
    (id) => !change.previousAssigneeIds.includes(id) && id !== membership.member.id,
  );

  for (const assigneeId of new Set(added)) {
    const assignee = await dependencies.memberships.findByMemberId(assigneeId);

    if (assignee?.member.canMessage === true) {
      await send(dependencies, assignee, {
        text: assignedText({
          assignerName: membership.member.name,
          title: change.title,
          date: change.date,
        }),
        taskId: change.taskId,
      });
    }
  }
}
