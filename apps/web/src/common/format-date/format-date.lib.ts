import { Temporal } from "temporal-polyfill";

const dayAndMonth = { day: "numeric", month: "long" } as const;
const plural = new Intl.PluralRules("ru-RU");

const years = { one: "год", few: "года", many: "лет", other: "года" } as const;
const months = { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" } as const;

type CountForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

function countOf(count: number, forms: CountForms): string {
  return `${count} ${forms[plural.select(count)] ?? forms.other}`;
}

export function deviceTimeZone(): string {
  return Temporal.Now.timeZoneId();
}

export type Viewer = { timeZone: string; today: string };

// This year's days drop the year; any other year keeps it, so last year's entry never reads as recent.
export function formatDay(epochMs: number, { timeZone, today: onDate }: Viewer): string {
  const day = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone);

  return formatShortDate(day.toPlainDate().toString(), onDate);
}

export function formatDayTime(epochMs: number, viewer: Viewer): string {
  const time = Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(viewer.timeZone)
    .toPlainTime();

  return `${formatDay(epochMs, viewer)}, ${time.toString({ smallestUnit: "minute" })}`;
}

export function formatDate(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString("ru-RU", {
    ...dayAndMonth,
    year: "numeric",
  });
}

export function formatShortDate(date: string, onDate: string): string {
  const day = Temporal.PlainDate.from(date);

  return day.year === Temporal.PlainDate.from(onDate).year
    ? day.toLocaleString("ru-RU", dayAndMonth)
    : formatDate(date);
}

// Near dates read as words and this year's dates drop the year: «Завтра», «23 октября».
export function formatNearDate(date: string, onDate: string): string {
  const day = Temporal.PlainDate.from(date);
  const shift = Temporal.PlainDate.from(onDate).until(day, { largestUnit: "days" }).days;
  const words: Record<number, string> = { [-1]: "Вчера", 0: "Сегодня", 1: "Завтра" };

  if (words[shift] !== undefined) {
    return words[shift];
  }

  return formatShortDate(date, onDate);
}

function zoneNameOf(timeZone: string, style: "shortGeneric" | "shortOffset"): string {
  return (
    new Intl.DateTimeFormat("ru-RU", { timeZone, timeZoneName: style })
      .formatToParts()
      .find(({ type }) => type === "timeZoneName")?.value ?? timeZone
  );
}

// A zone reads as a place with its offset, «Москва (GMT+3)», not as «Europe/Moscow».
export function formatTimeZone(timeZone: string): string {
  const place = zoneNameOf(timeZone, "shortGeneric");
  const offset = zoneNameOf(timeZone, "shortOffset");

  return place === offset ? offset : `${place} (${offset})`;
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

const shortYears = { one: "г", few: "г", many: "л", other: "г" } as const;
const shortMonths = { other: "м" } as const;

function yearsAndMonths(
  { birthDate, onDate }: { birthDate: string; onDate: string },
  units: { years: CountForms; months: CountForms },
): string[] {
  const age = Temporal.PlainDate.from(birthDate).until(onDate, { largestUnit: "years" });

  return [
    age.years > 0 ? countOf(age.years, units.years) : undefined,
    age.years === 0 || age.months > 0 ? countOf(age.months, units.months) : undefined,
  ].filter((part) => part !== undefined);
}

// «1 г 1 м» fits one line of a small tile; formatFullAge says the same for a screen reader.
export function formatShortAge(birthDate: string, onDate: string): string {
  return yearsAndMonths({ birthDate, onDate }, { years: shortYears, months: shortMonths })
    .map((part) => part.replace(" ", "\u00A0"))
    .join(" ");
}

export function formatFullAge(birthDate: string, onDate: string): string {
  return yearsAndMonths({ birthDate, onDate }, { years, months }).join(" ");
}

export type PickerType = "date" | "time" | "datetime-local";

const notChosen: Record<PickerType, string> = {
  date: "Не выбрана",
  time: "Не выбрано",
  "datetime-local": "Не выбрано",
};

// A picked date reads «пт, 30 окт»: Intl's abbreviated month ends with a dot, and only another year is spelled out.
function formatPickedDate(day: Temporal.PlainDate, onDate: string): string {
  const words = day
    .toLocaleString("ru-RU", { weekday: "short", day: "numeric", month: "short" })
    .replace(".", "");

  return day.year === Temporal.PlainDate.from(onDate).year ? words : `${words} ${day.year}`;
}

function formatPickedTime(time: Temporal.PlainTime): string {
  return time.toString({ smallestUnit: "minute" });
}

export function formatPickedValue(type: PickerType, value: string, onDate: string): string {
  if (value === "") {
    return notChosen[type];
  }

  if (type === "time") {
    return formatPickedTime(Temporal.PlainTime.from(value));
  }

  if (type === "date") {
    return formatPickedDate(Temporal.PlainDate.from(value), onDate);
  }

  const moment = Temporal.PlainDateTime.from(value);

  return `${formatPickedDate(moment.toPlainDate(), onDate)}, ${formatPickedTime(moment.toPlainTime())}`;
}
