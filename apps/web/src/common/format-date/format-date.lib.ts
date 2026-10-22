import { Temporal } from "temporal-polyfill";

const dayAndMonth = { day: "numeric", month: "long" } as const;
const plural = new Intl.PluralRules("ru-RU");

const years = { one: "год", few: "года", many: "лет", other: "года" } as const;
const months = { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" } as const;

function countOf(
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
): string {
  return `${count} ${forms[plural.select(count)] ?? forms.other}`;
}

export function deviceTimeZone(): string {
  return Temporal.Now.timeZoneId();
}

export function formatDay(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toLocaleString("ru-RU", dayAndMonth);
}

export function formatDate(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString("ru-RU", {
    ...dayAndMonth,
    year: "numeric",
  });
}

// Near dates read as words and this year's dates drop the year: «Завтра», «23 октября».
export function formatNearDate(date: string, onDate: string): string {
  const day = Temporal.PlainDate.from(date);
  const shift = Temporal.PlainDate.from(onDate).until(day, { largestUnit: "days" }).days;
  const words: Record<number, string> = { [-1]: "Вчера", 0: "Сегодня", 1: "Завтра" };

  if (words[shift] !== undefined) {
    return words[shift];
  }

  return day.year === Temporal.PlainDate.from(onDate).year
    ? day.toLocaleString("ru-RU", dayAndMonth)
    : formatDate(date);
}

export function today(timeZone: string): string {
  return Temporal.Now.plainDateISO(timeZone).toString();
}

export function formatAge(birthDate: string, onDate: string): string {
  const age = Temporal.PlainDate.from(birthDate).until(onDate, { largestUnit: "years" });

  if (age.years > 0) {
    return countOf(age.years, years);
  }

  return age.months > 0 ? countOf(age.months, months) : "меньше месяца";
}
