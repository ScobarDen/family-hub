import { dayAfter, firstOccurrenceFrom, type DateRange } from "./occurrence.ts";

const yearly = { frequency: "yearly", until: null } as const;

// The day of birth itself is no birthday to congratulate on.
export function birthdayFrom(birthDate: string, day: string): string | undefined {
  const firstBirthday = dayAfter(birthDate);

  return firstOccurrenceFrom(birthDate, yearly, day > firstBirthday ? day : firstBirthday);
}

export function birthdaysIn(birthDate: string, { from, to }: DateRange): string[] {
  const birthdays: string[] = [];

  for (
    let birthday = birthdayFrom(birthDate, from);
    birthday !== undefined && birthday <= to;
    birthday = birthdayFrom(birthDate, dayAfter(birthday))
  ) {
    birthdays.push(birthday);
  }

  return birthdays;
}
