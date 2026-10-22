import { Hono, type Context } from "hono";

import {
  eventChange,
  occurrenceSkip,
  type CalendarEvent,
  type CalendarEventList,
  type Deleted,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { EventRefusal, EventResult, EventService } from "./service/event.service.ts";

type EventEnv = {
  Variables: MemberEnv["Variables"] & { events: EventService };
};

const refuse = refusalsOf<EventRefusal>({
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
});

function reply(context: Context<EventEnv>, result: EventResult) {
  return result.status === "ok"
    ? context.json<CalendarEvent>(result.event)
    : refuse(context, result.status);
}

export const eventRoute = new Hono<EventEnv>()
  .use("/api/events/*", requireMember)
  .get("/api/events", async (context) =>
    context.json<CalendarEventList>(await context.var.events.list(context.var.membership)),
  )
  .post(
    "/api/events",
    jsonBody(eventChange, "An Event needs a title and a start; dates are YYYY-MM-DD"),
    async (context) => {
      const result = await context.var.events.create(
        context.var.membership,
        context.req.valid("json"),
      );

      return result.status === "ok"
        ? context.json<CalendarEvent>(result.event, httpStatus.created)
        : refuse(context, result.status);
    },
  )
  .put(
    "/api/events/:id",
    jsonBody(eventChange, "An Event needs a title and a start; dates are YYYY-MM-DD"),
    async (context) =>
      reply(
        context,
        await context.var.events.update(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json"),
        ),
      ),
  )
  .post(
    "/api/events/:id/skip",
    jsonBody(occurrenceSkip, "An Event needs a title and a start; dates are YYYY-MM-DD"),
    async (context) =>
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
      ? context.json<Deleted>(result)
      : refuse(context, result.status);
  });
