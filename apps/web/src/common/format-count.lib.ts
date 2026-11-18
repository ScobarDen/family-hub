const plural = new Intl.PluralRules("ru-RU");

export type CountWords = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function formatCount(count: number, words: CountWords): string {
  return `${count} ${words[plural.select(count)] ?? words.other}`;
}

const tenthsInOne = 10;

const tenths = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

const shortUnits: Array<{ size: number; suffix: string }> = [
  { size: 1_000_000, suffix: "м" },
  { size: 1_000, suffix: "к" },
];

// Rounds down, so 1 999 reads «1,9к» rather than an overstated «2к».
export function formatShortCount(count: number): string {
  const unit = shortUnits.find(({ size }) => count >= size);

  if (unit === undefined) {
    return String(count);
  }

  return `${tenths.format(Math.floor((count / unit.size) * tenthsInOne) / tenthsInOne)}${unit.suffix}`;
}
