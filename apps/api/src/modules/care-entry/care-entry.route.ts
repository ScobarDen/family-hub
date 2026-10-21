import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import {
  careEntryChange,
  expenseRange,
  type CareEntry,
  type CareEntryDeleted,
  type CareEntryList,
  type ExpenseSummary,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { CareEntryService } from "./care-entry.service.ts";

export type CareEntryEnv = {
  Variables: MemberEnv["Variables"] & { careEntries: CareEntryService };
};

const invalidEntry = apiError(
  "INVALID_REQUEST",
  "A Care Entry needs a time and the details of its Care Kind",
);
const entryBody = sValidator("json", careEntryChange, (result, context) =>
  result.success ? undefined : context.json(invalidEntry, httpStatus.badRequest),
);
const rangeQuery = sValidator("query", expenseRange, (result, context) =>
  result.success
    ? undefined
    : context.json(apiError("INVALID_REQUEST", "from and to are epoch ms"), httpStatus.badRequest),
);
const petNotFound = apiError("PET_NOT_FOUND", "No such Pet in the Family");
const entryNotFound = apiError("CARE_ENTRY_NOT_FOUND", "No such Care Entry in the Family");

export const careEntryRoute = new Hono<CareEntryEnv>()
  .use("/api/pets/:petId/care-entries", requireMember)
  .use("/api/pets/:petId/expenses", requireMember)
  .use("/api/care-entries/*", requireMember)
  .get("/api/pets/:petId/care-entries", async (context) =>
    context.json<CareEntryList>(
      await context.var.careEntries.list(context.var.membership, context.req.param("petId")),
    ),
  )
  .post("/api/pets/:petId/care-entries", entryBody, async (context) => {
    const created = await context.var.careEntries.create(
      context.var.membership,
      context.req.param("petId"),
      context.req.valid("json"),
    );

    return created
      ? context.json<CareEntry>(created, httpStatus.created)
      : context.json(petNotFound, httpStatus.notFound);
  })
  .get("/api/pets/:petId/expenses", rangeQuery, async (context) =>
    context.json<ExpenseSummary>(
      await context.var.careEntries.expenses(
        context.var.membership,
        context.req.param("petId"),
        context.req.valid("query"),
      ),
    ),
  )
  .put("/api/care-entries/:id", entryBody, async (context) => {
    const saved = await context.var.careEntries.update(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json"),
    );

    return saved
      ? context.json<CareEntry>(saved)
      : context.json(entryNotFound, httpStatus.notFound);
  })
  .delete("/api/care-entries/:id", async (context) => {
    const result = await context.var.careEntries.remove(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "deleted"
      ? context.json<CareEntryDeleted>(result)
      : context.json(entryNotFound, httpStatus.notFound);
  });
