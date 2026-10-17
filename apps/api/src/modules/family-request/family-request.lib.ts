import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { TelegramUser } from "@/common/auth";

import { callbackPrefix } from "./family-request.config.ts";
import type { FamilyRequest } from "./family-request.repo.ts";

export type Decision = "approve" | "reject";

type Callback = { decision: Decision; requestId: string };

const callbackPattern = new RegExp(`^${callbackPrefix}:(approve|reject):(.+)$`);

export function displayName(user: TelegramUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

export function operatorText(request: FamilyRequest): string {
  const username = request.requesterUsername === null ? "" : ` (@${request.requesterUsername})`;

  return `Новая заявка на семью\n\nСемья: ${request.familyName}\nОт: ${request.requesterName}${username}`;
}

export function decisionButtons(requestId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `${callbackPrefix}:approve:${requestId}` },
        { text: "❌ Отклонить", callback_data: `${callbackPrefix}:reject:${requestId}` },
      ],
    ],
  };
}

export function parseCallback(data: string | undefined): Callback | undefined {
  const match = callbackPattern.exec(data ?? "");

  if (match?.[2] === undefined) {
    return undefined;
  }

  return { decision: match[1] === "approve" ? "approve" : "reject", requestId: match[2] };
}

export const outcomeNote = {
  approved: "✅ Одобрено",
  rejected: "❌ Отклонено",
  stale: "⚪ Уже неактуально",
} as const;

export function approvedText(request: FamilyRequest): string {
  return `Семья «${request.familyName}» создана 🎉\n\nОткройте Family Hub — вы её Family Owner.`;
}

export function rejectedText(request: FamilyRequest): string {
  return `К сожалению, заявку на семью «${request.familyName}» не одобрили.\n\nОтправить новую можно через 7 дней.`;
}
