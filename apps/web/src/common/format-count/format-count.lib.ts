const plural = new Intl.PluralRules("ru-RU");

export type CountWords = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function formatCount(count: number, words: CountWords): string {
  return `${count} ${words[plural.select(count)] ?? words.other}`;
}
