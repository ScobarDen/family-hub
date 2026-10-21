import { sValidator } from "@hono/standard-validator";
import { Hono, type Context } from "hono";

import {
  reminderChange,
  type ErrorCode,
  type Reminder,
  type ReminderDeleted,
  type ReminderList,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { ReminderRefusal, ReminderResult } from "./reminder.types.ts";
import type { ReminderService } from "./service/reminder.service.ts";

export type ReminderEnv = {
  Variables: MemberEnv["Variables"] & { reminders: ReminderService };
};

const refusals = {
  "not-found": {
    code: "REMINDER_NOT_FOUND",
    message: "No such Reminder you can see",
    status: httpStatus.notFound,
  },
  "not-owner": {
    code: "NOT_REMINDER_OWNER",
    message: "Only the Reminder's owner may delete it",
    status: httpStatus.forbidden,
  },
  "visibility-one-way": {
    code: "VISIBILITY_ONE_WAY",
    message: "A Shared Reminder cannot become Private",
    status: httpStatus.conflict,
  },
  "recipients-not-allowed": {
    code: "RECIPIENTS_NOT_ALLOWED",
    message: "Recipients are Members of the Family; of a Private Reminder, only its owner",
    status: httpStatus.badRequest,
  },
} as const satisfies Record<ReminderRefusal, { code: ErrorCode; message: string; status: number }>;

function refuse(context: Context<ReminderEnv>, refusal: ReminderRefusal) {
  const { code, message, status } = refusals[refusal];

  return context.json(apiError(code, message), status);
}

function reply(
  context: Context<ReminderEnv>,
  result: ReminderResult,
  status?: typeof httpStatus.created,
) {
  return result.status === "ok"
    ? context.json<Reminder>(result.reminder, status)
    : refuse(context, result.status);
}

const body = sValidator("json", reminderChange, (result, context) =>
  result.success
    ? undefined
    : context.json(
        apiError("INVALID_REQUEST", "A Reminder needs a text, a date, a time and its zone"),
        httpStatus.badRequest,
      ),
);

export const reminderRoute = new Hono<ReminderEnv>()
  .use("/api/reminders", requireMember)
  .use("/api/reminders/*", requireMember)
  .get("/api/reminders", async (context) =>
    context.json<ReminderList>(await context.var.reminders.list(context.var.membership)),
  )
  .post("/api/reminders", body, async (context) =>
    reply(
      context,
      await context.var.reminders.create(context.var.membership, context.req.valid("json")),
      httpStatus.created,
    ),
  )
  .put("/api/reminders/:id", body, async (context) =>
    reply(
      context,
      await context.var.reminders.update(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
    ),
  )
  .delete("/api/reminders/:id", async (context) => {
    const result = await context.var.reminders.remove(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "deleted"
      ? context.json<ReminderDeleted>(result)
      : refuse(context, result.status);
  });
