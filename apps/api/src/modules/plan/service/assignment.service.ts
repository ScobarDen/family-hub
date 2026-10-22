import type { Membership } from "@/common/auth";
import { httpStatus } from "@/common/errors";
import { BotApiError } from "@/common/telegram";

import { assignedText, openPlanButton } from "../plan.lib.ts";
import type { PlanDependencies } from "../plan.types.ts";

type AssignmentChange = {
  planId: string;
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  previousAssigneeId: string | null;
};

async function send(
  { bot, appLinks, memberships, clock }: PlanDependencies,
  assignee: Membership,
  { text, planId }: { text: string; planId: string },
): Promise<void> {
  try {
    const url = await appLinks.appLink({ kind: "plan", id: planId });

    await bot.call("sendMessage", {
      chat_id: assignee.member.telegramId,
      text,
      reply_markup: openPlanButton(url),
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

// Only someone else's choice is news: assigning oneself or clearing the Assignee stays quiet.
export async function notifyAssignee(
  dependencies: PlanDependencies,
  membership: Membership,
  change: AssignmentChange,
): Promise<void> {
  const { assigneeId } = change;

  if (
    assigneeId === null ||
    assigneeId === change.previousAssigneeId ||
    assigneeId === membership.member.id
  ) {
    return;
  }

  const assignee = await dependencies.memberships.findByMemberId(assigneeId);

  if (assignee?.member.canMessage !== true) {
    return;
  }

  await send(dependencies, assignee, {
    text: assignedText({
      assignerName: membership.member.name,
      title: change.title,
      dueDate: change.dueDate,
    }),
    planId: change.planId,
  });
}
