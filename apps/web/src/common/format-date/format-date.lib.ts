import { Temporal } from "temporal-polyfill";

const dayAndMonth = { day: "numeric", month: "long" } as const;

export function deviceTimeZone(): string {
  return Temporal.Now.timeZoneId();
}

export function formatDay(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toLocaleString("ru-RU", dayAndMonth);
}
