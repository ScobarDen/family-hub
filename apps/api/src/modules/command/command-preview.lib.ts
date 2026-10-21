import { previewOf, type FamilyNames } from "@family-hub/commands";
import type { CareDetails, CommandDraft } from "@family-hub/contract";

const careEmoji: Record<CareDetails["kind"], string> = {
  vaccination: "💉",
  treatment: "💊",
  vet_visit: "🩺",
  weight: "⚖️",
  expense: "💸",
  note: "📝",
};

const missingAdvice = "Допишите в «Изменить» или скажите команду заново целиком.";

function emojiOf(draft: CommandDraft): string {
  if (draft.kind === "care_entry") {
    return draft.details === null ? "🐾" : careEmoji[draft.details.kind];
  }

  return draft.kind === "event" ? "📅" : "⏰";
}

// «⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася»
export function previewText(draft: CommandDraft, names: FamilyNames): string {
  const { title, details, missing, question, hint } = previewOf(draft, names);
  const line = [`${emojiOf(draft)} ${title}`, ...details].join(" · ");

  const advice = missing === undefined ? undefined : `${missing}. ${missingAdvice}`;

  return [line, advice, question?.title, hint].filter((part) => part !== undefined).join("\n\n");
}
