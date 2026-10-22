import {
  calendarEvent,
  calendarEventList,
  dueDateList,
  deleted,
  planList,
  reminder,
  reminderList,
  type EventChange,
  type ReminderChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createCalendarApi(client: HttpClient) {
  return {
    events: async () => client.request("/api/events", { schema: calendarEventList }),
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
      client.request(`/api/events/${eventId}`, { method: "DELETE", schema: deleted }),

    plans: async () => client.request("/api/plans", { schema: planList }),
    reminders: async () => client.request("/api/reminders", { schema: reminderList }),
    createReminder: async (change: ReminderChange) =>
      client.request("/api/reminders", { method: "POST", body: change, schema: reminder }),
    updateReminder: async (reminderId: string, change: ReminderChange) =>
      client.request(`/api/reminders/${reminderId}`, {
        method: "PUT",
        body: change,
        schema: reminder,
      }),
    removeReminder: async (reminderId: string) =>
      client.request(`/api/reminders/${reminderId}`, { method: "DELETE", schema: deleted }),
  };
}

export type CalendarApi = ReturnType<typeof createCalendarApi>;
