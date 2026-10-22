import { action, type Atom, computed, noop, withAsync, wrap } from "@reatom/core";

import type { CalendarEvent } from "@family-hub/contract";
import { occurrenceMoment, timeInZone } from "@family-hub/recurrence";

import { formatDate, formatDay } from "@/common/format-date";
import { reatomFailure } from "@/common/state";
import { type Confirmation, type Dialogs, isConfirmed } from "@/common/telegram";

import type { CalendarApi } from "../calendar.api.ts";
import { repeatTitles } from "../calendar.config.ts";
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
  telegram: Pick<Dialogs, "showPopup">;
  opened: Atom<OpenedOccurrence | undefined>;
  onClosed: () => void;
};

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

type ChangeSources = EventDetailsDependencies & {
  event: () => CalendarEvent | undefined;
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

    if (target === undefined || !(await wrap(isConfirmed(sources.telegram, confirmations[kind])))) {
      return;
    }

    await wrap(apply(sources, { kind, target }));
    sources.onClosed();
  }, "calendar.details.change").extend(withAsync());
}

export function reatomEventDetails(dependencies: EventDetailsDependencies) {
  const { data, opened } = dependencies;
  const event = computed(
    () => data.events.data()?.find(({ id }) => id === opened()?.eventId),
    "calendar.details.event",
  );
  const change = reatomChange({ ...dependencies, event });

  return {
    event,
    details: computed((): EventDetails | undefined => {
      const current = event();
      const target = opened();

      return current === undefined || target === undefined
        ? undefined
        : detailsOf(current, target.occurrence ?? current.start.date, dependencies.timeZone());
    }, "calendar.details"),
    failure: reatomFailure(change, {
      message: "Не получилось. Попробуйте ещё раз.",
      name: "calendar.details.failure",
    }),
    skipOccurrence: action(() => {
      change("skip").catch(noop);
    }, "calendar.details.skip"),
    removeEvent: action(() => {
      change("delete").catch(noop);
    }, "calendar.details.remove"),
  };
}

export type EventDetailsModel = ReturnType<typeof reatomEventDetails>;
