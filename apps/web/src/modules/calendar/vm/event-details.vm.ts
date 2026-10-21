import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import type { CalendarEvent } from "@family-hub/contract";
import { occurrenceMoment, timeInZone } from "@family-hub/recurrence";

import { formatDate, formatDay } from "@/common/format-date";
import type { PopupParams } from "@/common/telegram";

import type { CalendarApi } from "../calendar.api.ts";
import type { CalendarData } from "../calendar.model.ts";

export type OpenedOccurrence = { eventId: string; occurrence: string | undefined };

export type EventDetails = {
  title: string;
  when: string;
  repeats: string | undefined;
  note: string | undefined;
  isPrivate: boolean;
  isRecurring: boolean;
  canDelete: boolean;
};

type EventDetailsDependencies = {
  api: CalendarApi;
  data: Pick<CalendarData, "events" | "keep" | "drop">;
  timeZone: () => string;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  opened: Atom<OpenedOccurrence | undefined>;
  onClosed: () => void;
};

type Confirmation = { title: string; message: string; button: string };

const repeatTitles = { weekly: "Каждую неделю", monthly: "Каждый месяц", yearly: "Каждый год" };

const confirmations: Record<"skip" | "delete", Confirmation> = {
  skip: {
    title: "Пропустить этот раз?",
    message: "Остальные повторы останутся.",
    button: "Пропустить",
  },
  delete: {
    title: "Удалить событие?",
    message: "Событие пропадёт у всей семьи со всеми повторами.",
    button: "Удалить",
  },
};

function whenOf(event: CalendarEvent, occurrence: string, viewerZone: string): string {
  const { start } = event;

  if (start.time === null || start.timeZone === null) {
    const end = event.end === null ? "" : ` — ${formatDate(event.end.date)}`;

    return `${formatDate(occurrence)}${end}, весь день`;
  }

  const moment = occurrenceMoment(occurrence, { time: start.time, timeZone: start.timeZone });

  return `${formatDay(moment, viewerZone)}, ${timeInZone(moment, viewerZone)}`;
}

function repeatsOf({ recurrence }: CalendarEvent): string | undefined {
  if (recurrence === null) {
    return undefined;
  }

  const until = recurrence.until === null ? "" : ` до ${formatDate(recurrence.until)}`;

  return `${repeatTitles[recurrence.frequency]}${until}`;
}

function detailsOf(event: CalendarEvent, occurrence: string, viewerZone: string): EventDetails {
  return {
    title: event.title,
    when: whenOf(event, occurrence, viewerZone),
    repeats: repeatsOf(event),
    note: event.note ?? undefined,
    isPrivate: event.visibility === "private",
    isRecurring: event.recurrence !== null,
    canDelete: event.isOwn,
  };
}

async function isConfirmed(
  { telegram }: EventDetailsDependencies,
  { title, message, button }: Confirmation,
): Promise<boolean> {
  const choice = await wrap(
    telegram.showPopup({
      title,
      message,
      buttons: [
        { id: "confirm", type: "destructive", text: button },
        { id: "cancel", type: "cancel" },
      ],
    }),
  );

  return choice === "confirm";
}

type ChangeSources = EventDetailsDependencies & {
  event: () => CalendarEvent | undefined;
  failure: Atom<string | undefined>;
};

async function apply(
  { api, data, event }: ChangeSources,
  { kind, target }: { kind: "skip" | "delete"; target: OpenedOccurrence },
): Promise<void> {
  if (kind === "delete") {
    await wrap(api.remove(target.eventId));
    data.drop(target.eventId);

    return;
  }

  const occurrence = target.occurrence ?? event()?.start.date;

  if (occurrence !== undefined) {
    data.keep(await wrap(api.skip(target.eventId, occurrence)));
  }
}

function reatomChange(sources: ChangeSources) {
  return action(async (kind: "skip" | "delete") => {
    const target = sources.opened();

    if (target === undefined || !(await wrap(isConfirmed(sources, confirmations[kind])))) {
      return;
    }

    sources.failure.set(undefined);

    try {
      await wrap(apply(sources, { kind, target }));
      sources.onClosed();
    } catch {
      sources.failure.set("Не получилось. Попробуйте ещё раз.");
    }
  }, "calendar.details.change").extend(withAsync());
}

export function reatomEventDetails(dependencies: EventDetailsDependencies) {
  const { data, opened } = dependencies;
  const failure = atom<string | undefined>(undefined, "calendar.details.failure");
  const event = computed(
    () => data.events.data()?.find(({ id }) => id === opened()?.eventId),
    "calendar.details.event",
  );
  const change = reatomChange({ ...dependencies, event, failure });

  return {
    event,
    details: computed((): EventDetails | undefined => {
      const current = event();
      const target = opened();

      return current === undefined || target === undefined
        ? undefined
        : detailsOf(current, target.occurrence ?? current.start.date, dependencies.timeZone());
    }, "calendar.details"),
    failure: computed(() => failure(), "calendar.details.visibleFailure"),
    skipOccurrence: action(() => {
      change("skip").catch(noop);
    }, "calendar.details.skip"),
    removeEvent: action(() => {
      change("delete").catch(noop);
    }, "calendar.details.remove"),
  };
}

export type EventDetailsModel = ReturnType<typeof reatomEventDetails>;
