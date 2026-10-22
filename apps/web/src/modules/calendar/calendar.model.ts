import { action, computed, noop, withAsyncData, wrap } from "@reatom/core";

import type { CalendarEvent, Pet, Reminder } from "@family-hub/contract";

import type { CalendarApi } from "./calendar.api.ts";
import type { PetDue } from "./calendar.lib.ts";

async function duesOf(api: CalendarApi, pet: Pet): Promise<PetDue[]> {
  const dues = await api.dueDates(pet.id);

  return dues.map((due) => ({ ...due, petId: pet.id }));
}

// Due Dates belong to each Pet in care, so they are gathered Pet by Pet.
function reatomDues(api: CalendarApi) {
  return computed(async (): Promise<PetDue[]> => {
    const all = await wrap(api.pets());
    const inCare = all.filter(({ archivedAt }) => archivedAt === null);
    const lists = await wrap(Promise.all(inCare.map(async (pet) => duesOf(api, pet))));

    return lists.flat();
  }, "calendar.dues").extend(withAsyncData());
}

export function reatomCalendarData({ api }: { api: CalendarApi }) {
  const events = computed(async () => wrap(api.events()), "calendar.events").extend(
    withAsyncData(),
  );
  const pets = computed(async () => wrap(api.pets()), "calendar.pets").extend(withAsyncData());

  const plans = computed(async () => wrap(api.plans()), "calendar.plans").extend(withAsyncData());
  const reminders = computed(async () => wrap(api.reminders()), "calendar.reminders").extend(
    withAsyncData(),
  );

  const dues = reatomDues(api);

  return {
    events,
    pets,
    plans,
    reminders,
    members: computed(async () => wrap(api.members()), "calendar.members").extend(withAsyncData()),
    dues,

    reload: action(() => {
      for (const records of [events, reminders, dues]) {
        records.retry().catch(noop);
      }
    }, "calendar.reload"),

    keep: action((saved: CalendarEvent) => {
      const others = (events.data() ?? []).filter(({ id }) => id !== saved.id);

      events.data.set([...others, saved]);
    }, "calendar.keep"),
    drop: action((eventId: string) => {
      events.data.set(events.data()?.filter(({ id }) => id !== eventId));
    }, "calendar.drop"),
    keepReminder: action((saved: Reminder) => {
      const others = (reminders.data() ?? []).filter(({ id }) => id !== saved.id);

      reminders.data.set([...others, saved]);
    }, "calendar.keepReminder"),
    dropReminder: action((reminderId: string) => {
      reminders.data.set(reminders.data()?.filter(({ id }) => id !== reminderId));
    }, "calendar.dropReminder"),
  };
}

export type CalendarData = ReturnType<typeof reatomCalendarData>;
