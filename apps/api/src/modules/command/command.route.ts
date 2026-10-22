import { sValidator } from "@hono/standard-validator";
import { Hono, type Context } from "hono";

import {
  draftPick,
  type BotChat,
  voiceMaxBytes,
  type CommandOutcome,
  type DraftCreated,
  type DraftSettled,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { CommandService } from "./service/command.service.ts";

export type CommandEnv = {
  Variables: MemberEnv["Variables"] & { commands: CommandService };
};

const audioTypePattern = /^audio\//u;

function notFound(context: Context<CommandEnv>) {
  return context.json(
    apiError("COMMAND_DRAFT_NOT_FOUND", "No such pending Command Draft of yours"),
    httpStatus.notFound,
  );
}

// The recording streams on to Whisper, so its size is judged by the header before any read.
function audioRefusal(context: Context<CommandEnv>) {
  const type = context.req.header("content-type") ?? "";
  const length = Number(context.req.header("content-length"));

  if (!audioTypePattern.test(type)) {
    return context.json(
      apiError("AUDIO_TYPE_UNSUPPORTED", "Send the recording with its audio content type"),
      httpStatus.unsupportedMediaType,
    );
  }

  if (!Number.isFinite(length) || length <= 0) {
    return context.json(
      apiError("INVALID_REQUEST", "A recording needs its Content-Length"),
      httpStatus.lengthRequired,
    );
  }

  return length > voiceMaxBytes
    ? context.json(
        apiError("AUDIO_TOO_LARGE", "A recording is at most 30 seconds"),
        httpStatus.payloadTooLarge,
      )
    : undefined;
}

const pickBody = sValidator("json", draftPick, (result, context) =>
  result.success
    ? undefined
    : context.json(apiError("INVALID_REQUEST", "Pick a candidate by index"), httpStatus.badRequest),
);

export const commandRoute = new Hono<CommandEnv>()
  .use("/api/commands/*", requireMember)
  .get("/api/commands/bot", async (context) =>
    context.json<BotChat>(await context.var.commands.miniApp.botChat()),
  )
  .post("/api/commands/voice", async (context) => {
    const refusal = audioRefusal(context);
    const body = context.req.raw.body;

    if (refusal !== undefined) {
      return refusal;
    }

    if (body === null) {
      return context.json(apiError("INVALID_REQUEST", "Empty recording"), httpStatus.badRequest);
    }

    return context.json<CommandOutcome>(
      await context.var.commands.miniApp.fromAudio(context.var.membership, {
        body,
        contentType: context.req.header("content-type") ?? "",
      }),
    );
  })
  .get("/api/commands/:id", async (context) => {
    const result = await context.var.commands.miniApp.open(
      context.var.membership,
      context.req.param("id"),
    );

    return result === "not-found" ? notFound(context) : context.json<CommandOutcome>(result);
  })
  .post("/api/commands/:id/create", async (context) => {
    const result = await context.var.commands.miniApp.create(
      context.var.membership,
      context.req.param("id"),
    );

    if (result === "not-found") {
      return notFound(context);
    }

    return typeof result === "string"
      ? context.json(
          apiError(result, "The record's use case refused the draft"),
          httpStatus.conflict,
        )
      : context.json<DraftCreated>(result, httpStatus.created);
  })
  .post("/api/commands/:id/pick", pickBody, async (context) => {
    const result = await context.var.commands.miniApp.pick(context.var.membership, {
      draftId: context.req.param("id"),
      index: context.req.valid("json").index,
    });

    return result === "not-found" ? notFound(context) : context.json<CommandOutcome>(result);
  })
  .post("/api/commands/:id/dismiss", async (context) => {
    const result = await context.var.commands.miniApp.dismiss(
      context.var.membership,
      context.req.param("id"),
    );

    return result === "not-found"
      ? notFound(context)
      : context.json<DraftSettled>({ status: "dismissed" });
  })
  .post("/api/commands/:id/created", async (context) => {
    const result = await context.var.commands.miniApp.markCreated(
      context.var.membership,
      context.req.param("id"),
    );

    return result === "not-found"
      ? notFound(context)
      : context.json<DraftSettled>({ status: "created" });
  });
