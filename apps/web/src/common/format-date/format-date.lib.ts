import { Temporal } from "temporal-polyfill";

const dayAndMonth = { day: "numeric", month: "long" } as const;
const plural = new Intl.PluralRules("ru-RU");

const years = { one: "год", few: "года", many: "лет", other: "года" } as const;
const months = { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" } as const;

function countOf(count: number, forms: Record<"one" | "few" | "many" | "other", string>): string {
  const form = plural.select(count);

  return `${count} ${form === "zero" || form === "two" ? forms.other : forms[form]}`;
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
