import {
  calendarEvent,
  calendarEventList,
  dueDateList,
  eventDeleted,
  petList,
  type EventChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createCalendarApi(client: HttpClient) {
  return {
    events: async () => client.request("/api/events", { schema: calendarEventList }),
    pets: async () => client.request("/api/pets", { schema: petList }),
    dueDates: async (petId: string) =>
      client.request(`/api/pets/${petId}/due-dates`, { schema: dueDateList }),

    create: async (change: EventChange) =>
      client.request("/api/events", { method: "POST", body: change, schema: calendarEvent }),
    update: async (eventId: string, change: EventChange) =>
      client.request(`/api/events/${eventId}`, {
        method: "PUT",
        body: change,
        schema: calendarEvent,
      }),
    skip: async (eventId: string, date: string) =>
      client.request(`/api/events/${eventId}/skip`, {
        method: "POST",
        body: { date },
        schema: calendarEvent,
      }),
    remove: async (eventId: string) =>
      client.request(`/api/events/${eventId}`, { method: "DELETE", schema: eventDeleted }),
  };
}

export type CalendarApi = ReturnType<typeof createCalendarApi>;
