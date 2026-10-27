import { Hono, type Context } from "hono";

import {
  occurrenceTarget,
  skipTarget,
  subtaskChange,
  taskChange,
  type Deleted,
  type Task,
  type TaskList,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { TaskService } from "./service/task.service.ts";
import type { TaskRefusal, TaskResult } from "./task.types.ts";

type TaskEnv = {
  Variables: MemberEnv["Variables"] & { tasks: TaskService };
};

const refuse = refusalsOf<TaskRefusal>({
  "not-found": {
    code: "TASK_NOT_FOUND",
    message: "No such Task or Subtask you can see",
    status: httpStatus.notFound,
  },
  "not-owner": {
    code: "NOT_TASK_OWNER",
    message: "Only the Task's owner may delete it",
    status: httpStatus.forbidden,
  },
  "assignee-not-allowed": {
    code: "ASSIGNEE_NOT_ALLOWED",
    message: "Assignees are Members of the Family; of a Private Task, only its owner",
    status: httpStatus.badRequest,
  },
  "recipients-not-allowed": {
    code: "RECIPIENTS_NOT_ALLOWED",
    message: "Recipients are Members of the Family; of a Private Task, only its owner",
    status: httpStatus.badRequest,
  },
  "pet-not-found": {
    code: "PET_NOT_FOUND",
    message: "The Task's Pet is not a Pet of the Family",
    status: httpStatus.badRequest,
  },
  "album-not-found": {
    code: "ALBUM_NOT_IN_FAMILY",
    message: "The Task's Album is not an Album of the Family",
    status: httpStatus.badRequest,
  },
  "visibility-one-way": {
    code: "VISIBILITY_ONE_WAY",
    message: "A Shared Task cannot become Private",
    status: httpStatus.conflict,
  },
  "subtasks-not-allowed": {
    code: "SUBTASKS_NOT_ALLOWED",
    message: "A recurring Task has no Subtasks",
    status: httpStatus.conflict,
  },
});

function reply(context: Context<TaskEnv>, result: TaskResult, status?: typeof httpStatus.created) {
  return result.status === "ok"
    ? context.json<Task>(result.task, status)
    : refuse(context, result.status);
}

function subtaskOf(context: Context<TaskEnv>) {
  return { taskId: context.req.param("id") ?? "", subtaskId: context.req.param("subtaskId") ?? "" };
}

const taskBody = jsonBody(
  taskChange,
  "A title is required; Recurrence and Reminders need a date, minutes and hours before a time",
);
const subtaskBody = jsonBody(subtaskChange, "A title is required; dates are YYYY-MM-DD");
const occurrenceBody = jsonBody(occurrenceTarget, "The Occurrence is a date or null");
const subtaskPath = "/api/tasks/:id/subtasks/:subtaskId";

export const taskRoute = new Hono<TaskEnv>()
  .use("/api/tasks/*", requireMember)
  .get("/api/tasks", async (context) =>
    context.json<TaskList>(await context.var.tasks.list(context.var.membership)),
  )
  .post("/api/tasks", taskBody, async (context) =>
    reply(
      context,
      await context.var.tasks.create(context.var.membership, context.req.valid("json")),
      httpStatus.created,
    ),
  )
  .put("/api/tasks/:id", taskBody, async (context) =>
    reply(
      context,
      await context.var.tasks.update(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
    ),
  )
  .delete("/api/tasks/:id", async (context) => {
    const result = await context.var.tasks.remove(context.var.membership, context.req.param("id"));

    return result.status === "deleted"
      ? context.json<Deleted>(result)
      : refuse(context, result.status);
  })
  .post("/api/tasks/:id/complete", occurrenceBody, async (context) =>
    reply(
      context,
      await context.var.tasks.complete(context.var.membership, {
        taskId: context.req.param("id"),
        occurrence: context.req.valid("json").occurrence,
      }),
    ),
  )
  .post("/api/tasks/:id/reopen", occurrenceBody, async (context) =>
    reply(
      context,
      await context.var.tasks.reopen(context.var.membership, {
        taskId: context.req.param("id"),
        occurrence: context.req.valid("json").occurrence,
      }),
    ),
  )
  .post(
    "/api/tasks/:id/skip",
    jsonBody(skipTarget, "The skipped Occurrence is a date"),
    async (context) =>
      reply(
        context,
        await context.var.tasks.skip(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json").date,
        ),
      ),
  )
  .post("/api/tasks/:id/subtasks", subtaskBody, async (context) =>
    reply(
      context,
      await context.var.tasks.addSubtask(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
      httpStatus.created,
    ),
  )
  .put(subtaskPath, subtaskBody, async (context) =>
    reply(
      context,
      await context.var.tasks.updateSubtask(
        context.var.membership,
        subtaskOf(context),
        context.req.valid("json"),
      ),
    ),
  )
  .delete(subtaskPath, async (context) =>
    reply(
      context,
      await context.var.tasks.removeSubtask(context.var.membership, subtaskOf(context)),
    ),
  )
  .post(`${subtaskPath}/complete`, async (context) =>
    reply(
      context,
      await context.var.tasks.markSubtask(context.var.membership, subtaskOf(context), true),
    ),
  )
  .post(`${subtaskPath}/reopen`, async (context) =>
    reply(
      context,
      await context.var.tasks.markSubtask(context.var.membership, subtaskOf(context), false),
    ),
  );
