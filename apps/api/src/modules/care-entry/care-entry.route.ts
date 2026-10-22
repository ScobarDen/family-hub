import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import {
  careEntryChange,
  expenseRange,
  type CareEntry,
  type Deleted,
  type CareEntryList,
  type DueDateList,
  type ExpenseSummary,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { CareEntryService, CareRefusal } from "./service/care-entry.service.ts";

type CareEntryEnv = {
  Variables: MemberEnv["Variables"] & { careEntries: CareEntryService };
};

const refuse = refusalsOf<CareRefusal>({
  "not-found": {
    code: "CARE_ENTRY_NOT_FOUND",
    message: "No such Care Entry in the Family",
    status: httpStatus.notFound,
  },
  "pet-not-found": {
    code: "PET_NOT_FOUND",
    message: "No such Pet in the Family",
    status: httpStatus.notFound,
  },
  archived: {
    code: "PET_ARCHIVED",
    message: "An archived Pet's journal reads only",
    status: httpStatus.conflict,
  },
  "photo-not-found": {
    code: "PHOTO_NOT_FOUND",
    message: "Attach photos uploaded to the Family, at most five",
    status: httpStatus.badRequest,
  },
});

const entryBody = jsonBody(
  careEntryChange,
  "A Care Entry needs a time and the details of its Care Kind",
);
const rangeQuery = sValidator("query", expenseRange, (result, context) =>
  result.success
    ? undefined
    : context.json(apiError("INVALID_REQUEST", "from and to are epoch ms"), httpStatus.badRequest),
);

export const careEntryRoute = new Hono<CareEntryEnv>()
  .use("/api/pets/:petId/care-entries", requireMember)
  .use("/api/pets/:petId/expenses", requireMember)
  .use("/api/pets/:petId/due-dates", requireMember)
  .use("/api/care-entries/*", requireMember)
  .get("/api/pets/:petId/care-entries", async (context) =>
    context.json<CareEntryList>(
      await context.var.careEntries.list(context.var.membership, context.req.param("petId")),
    ),
  )
  .post("/api/pets/:petId/care-entries", entryBody, async (context) => {
    const result = await context.var.careEntries.create(
      context.var.membership,
      context.req.param("petId"),
      context.req.valid("json"),
    );

    return result.status === "ok"
      ? context.json<CareEntry>(result.entry, httpStatus.created)
      : refuse(context, result.status);
  })
  .get("/api/pets/:petId/due-dates", async (context) =>
    context.json<DueDateList>(
      await context.var.careEntries.dueDates(context.var.membership, context.req.param("petId")),
    ),
  )
  .get("/api/pets/:petId/expenses", rangeQuery, async (context) =>
    context.json<ExpenseSummary>(
      await context.var.careEntries.expenses(
        context.var.membership,
        context.req.param("petId"),
        context.req.valid("query"),
      ),
    ),
  )
  .get("/api/care-entries/:id", async (context) => {
    const result = await context.var.careEntries.get(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "ok"
      ? context.json<CareEntry>(result.entry)
      : refuse(context, result.status);
  })
  .put("/api/care-entries/:id", entryBody, async (context) => {
    const result = await context.var.careEntries.update(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json"),
    );

    return result.status === "ok"
      ? context.json<CareEntry>(result.entry)
      : refuse(context, result.status);
  })
  .delete("/api/care-entries/:id", async (context) => {
    const result = await context.var.careEntries.remove(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "deleted"
      ? context.json<Deleted>(result)
      : refuse(context, result.status);
  });
