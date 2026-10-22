import { action, computed, noop, withAsyncData, wrap } from "@reatom/core";

import type { CalendarEvent, FamilyMember, Pet, Reminder } from "@family-hub/contract";

import { upserted, withoutId } from "@/common/records";

import type { CalendarApi } from "./calendar.api.ts";
import type { PetDue } from "./calendar.lib.ts";

async function duesOf(api: CalendarApi, pet: Pet): Promise<PetDue[]> {
  const dues = await api.dueDates(pet.id);

  return dues.map((due) => ({ ...due, petId: pet.id }));
}

// Due Dates belong to each Pet in care, so they are gathered Pet by Pet.
function reatomDues(api: CalendarApi, pets: Loaded<Pet>) {
  return computed(async (): Promise<PetDue[]> => {
    const inCare = (pets.data() ?? []).filter(({ archivedAt }) => archivedAt === null);
    const lists = await wrap(Promise.all(inCare.map(async (pet) => duesOf(api, pet))));

    return lists.flat();
  }, "calendar.dues").extend(withAsyncData());
}

type Loaded<Item> = { data: () => Item[] | undefined };

// Members and Pets are the Family's shared queries, loaded once for every module.
export type CalendarLists = { members: Loaded<FamilyMember>; pets: Loaded<Pet> };

export function reatomCalendarData({ api, members, pets }: CalendarLists & { api: CalendarApi }) {
  const events = computed(async () => wrap(api.events()), "calendar.events").extend(
    withAsyncData(),
  );

  const plans = computed(async () => wrap(api.plans()), "calendar.plans").extend(withAsyncData());
  const reminders = computed(async () => wrap(api.reminders()), "calendar.reminders").extend(
    withAsyncData(),
  );

  const dues = reatomDues(api, pets);

  return {
    events,
    pets,
    plans,
    reminders,
    members,
    dues,

    reload: action(() => {
      for (const records of [events, reminders, dues]) {
        records.retry().catch(noop);
      }
    }, "calendar.reload"),

    keep: action((saved: CalendarEvent) => {
      events.data.set(upserted(events.data() ?? [], saved));
    }, "calendar.keep"),
    drop: action((eventId: string) => {
      events.data.set(withoutId(events.data() ?? [], eventId));
    }, "calendar.drop"),
    keepReminder: action((saved: Reminder) => {
      reminders.data.set(upserted(reminders.data() ?? [], saved));
    }, "calendar.keepReminder"),
    dropReminder: action((reminderId: string) => {
      reminders.data.set(withoutId(reminders.data() ?? [], reminderId));
    }, "calendar.dropReminder"),
  };
}

export type CalendarData = ReturnType<typeof reatomCalendarData>;
