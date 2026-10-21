import { sValidator } from "@hono/standard-validator";
import { Hono, type Context } from "hono";

import {
  eventChange,
  occurrenceSkip,
  type CalendarEvent,
  type CalendarEventList,
  type ErrorCode,
  type EventDeleted,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { EventRefusal, EventResult, EventService } from "./event.service.ts";

export type EventEnv = {
  Variables: MemberEnv["Variables"] & { events: EventService };
};

const refusals = {
  "not-found": {
    code: "EVENT_NOT_FOUND",
    message: "No such Event you can see",
    status: httpStatus.notFound,
  },
  "not-owner": {
    code: "NOT_EVENT_OWNER",
    message: "Only the Event's owner may delete it",
    status: httpStatus.forbidden,
  },
  "visibility-one-way": {
    code: "VISIBILITY_ONE_WAY",
    message: "A Shared Event cannot become Private",
    status: httpStatus.conflict,
  },
} as const satisfies Record<EventRefusal, { code: ErrorCode; message: string; status: number }>;

function refuse(context: Context<EventEnv>, refusal: EventRefusal) {
  const { code, message, status } = refusals[refusal];

  return context.json(apiError(code, message), status);
}

function reply(context: Context<EventEnv>, result: EventResult) {
  return result.status === "ok"
    ? context.json<CalendarEvent>(result.event)
    : refuse(context, result.status);
}

function bodyOf<Schema extends typeof eventChange | typeof occurrenceSkip>(schema: Schema) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(
          apiError("INVALID_REQUEST", "An Event needs a title and a start; dates are YYYY-MM-DD"),
          httpStatus.badRequest,
        ),
  );
}

export const eventRoute = new Hono<EventEnv>()
  .use("/api/events", requireMember)
  .use("/api/events/*", requireMember)
  .get("/api/events", async (context) =>
    context.json<CalendarEventList>(await context.var.events.list(context.var.membership)),
  )
  .post("/api/events", bodyOf(eventChange), async (context) => {
    const result = await context.var.events.create(
      context.var.membership,
      context.req.valid("json"),
    );

    return result.status === "ok"
      ? context.json<CalendarEvent>(result.event, httpStatus.created)
      : refuse(context, result.status);
  })
  .put("/api/events/:id", bodyOf(eventChange), async (context) =>
    reply(
      context,
      await context.var.events.update(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
    ),
  )
  .post("/api/events/:id/skip", bodyOf(occurrenceSkip), async (context) =>
    reply(
      context,
      await context.var.events.skip(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json").date,
      ),
    ),
  )
  .delete("/api/events/:id", async (context) => {
    const result = await context.var.events.remove(context.var.membership, context.req.param("id"));

    return result.status === "deleted"
      ? context.json<EventDeleted>(result)
      : refuse(context, result.status);
  });
