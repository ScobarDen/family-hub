import { Hono } from "hono";

import { pushPress } from "@family-hub/contract";

import { apiError, httpStatus, jsonBody } from "@/common/errors.lib.ts";

import type { ReminderService } from "./service/reminder.service.ts";

type ReminderEnv = { Variables: { reminders: ReminderService } };

// No session: a Push's button comes from the service worker, and its token names the presser
// (ADR 0016).
export const reminderRoute = new Hono<ReminderEnv>().post(
  "/api/reminders/press",
  jsonBody(pushPress, "A press token and «done» or «snooze» are required"),
  async (context) => {
    const refusal = await context.var.reminders.handlePushPress(context.req.valid("json"));

    return refusal === undefined
      ? context.body(null, httpStatus.noContent)
      : context.json(apiError("PRESS_REFUSED", refusal), httpStatus.conflict);
  },
);
