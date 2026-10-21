import { occurrenceMoment, timeInZone } from "./occurrence.ts";

export type Phrase = { saidAt: number; timeZone: string };

export type PhraseWhen = { date: string | null; time: string | null };

// A draft confirmed hours later, or after its speaker changed zone, still means the day, the
// time of day and the zone it was said in.
export function momentOfPhrase({ date, time }: PhraseWhen, { saidAt, timeZone }: Phrase): number {
  return date === null
    ? saidAt
    : occurrenceMoment(date, { time: time ?? timeInZone(saidAt, timeZone), timeZone });
}
