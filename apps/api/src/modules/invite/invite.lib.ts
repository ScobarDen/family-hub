import type { InlineQueryResultArticle } from "@grammyjs/types";

import { encodeDeepLink } from "@family-hub/contract";

import { inviteTokenBytes } from "./invite.config.ts";

export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(inviteTokenBytes));

  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function inviteLink(miniAppLink: string, token: string): string {
  const link = new URL(miniAppLink);

  link.searchParams.set("startapp", encodeDeepLink({ kind: "inv", id: token }));

  return link.toString();
}

type ShareCard = { inviteId: string; link: string; inviterName: string; familyName: string };

export function shareCard({
  inviteId,
  link,
  inviterName,
  familyName,
}: ShareCard): InlineQueryResultArticle {
  return {
    type: "article",
    id: inviteId,
    title: `Приглашение в семью «${familyName}»`,
    input_message_content: { message_text: `${inviterName} зовёт вас в семью «${familyName}»` },
    reply_markup: { inline_keyboard: [[{ text: "Вступить", url: link }]] },
  };
}
