import { previewOf, type FamilyNames } from "@family-hub/commands";
import type { CommandDraft } from "@family-hub/contract";

import { emojiOf } from "./draft-kind.lib.ts";

const missingAdvice = "Допишите в «Изменить» или скажите команду заново целиком.";

// «⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася»
export function previewText(draft: CommandDraft, names: FamilyNames): string {
  const { title, details, missing, question, hint } = previewOf(draft, names);
  const line = [`${emojiOf(draft)} ${title}`, ...details].join(" · ");

  const advice = missing === undefined ? undefined : `${missing}. ${missingAdvice}`;

  return [line, advice, question?.title, hint].filter((part) => part !== undefined).join("\n\n");
}
