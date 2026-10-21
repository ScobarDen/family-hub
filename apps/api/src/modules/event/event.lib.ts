import type { CalendarEvent, EventChange } from "@family-hub/contract";

import type { EventRow } from "./event.repo.ts";

export function toEvent(row: EventRow, memberId: string): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    start: { date: row.startDate, time: row.startTime, timeZone: row.timeZone },
    end: row.endDate === null ? null : { date: row.endDate, time: row.endTime },
    recurrence: row.frequency === null ? null : { frequency: row.frequency, until: row.until },
    visibility: row.visibility,
    reminderOffsets: row.reminderOffsets,
    isOwn: row.ownerMemberId === memberId,
    skippedDates: row.skippedDates,
  };
}

function endColumnsOf({ end }: EventChange) {
  return end === null ? { endDate: null, endTime: null } : { endDate: end.date, endTime: end.time };
}

function recurrenceColumnsOf({ recurrence }: EventChange) {
  return recurrence === null
    ? { frequency: null, until: null }
    : { frequency: recurrence.frequency, until: recurrence.until };
}

export function columnsOf(change: EventChange) {
  return {
    title: change.title,
    note: change.note,
    visibility: change.visibility,
    reminderOffsets: change.reminderOffsets,
    startDate: change.start.date,
    startTime: change.start.time,
    timeZone: change.start.timeZone,
    ...endColumnsOf(change),
    ...recurrenceColumnsOf(change),
  };
}
