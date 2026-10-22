import {
  action,
  atom,
  computed,
  isAbort,
  noop,
  withAbort,
  withAsyncData,
  wrap,
  type Atom,
} from "@reatom/core";

import {
  draftRefusalTexts,
  previewOf,
  type DraftPreview,
  type FamilyNames,
} from "@family-hub/commands";
import {
  draftRefusal,
  type CommandDraft,
  type CommandOutcome,
  type CommandPhrase,
  type DraftCreated,
} from "@family-hub/contract";

import { HttpError } from "@/common/http-client";

import type { CommandApi } from "../command.api.ts";

export type OpenedDraft = { draftId: string; draft: CommandDraft; phrase: CommandPhrase };

type CommandSheetDependencies = {
  api: Pick<CommandApi, "send" | "open" | "create" | "pick" | "dismiss" | "members" | "pets">;
  // «Изменить» hands the draft to the module whose form creates that kind of record.
  onEdit: (opened: OpenedDraft) => void;
  onCreated: (created: DraftCreated) => void;
};

export type CommandSheet =
  | { kind: "closed" }
  | { kind: "sending" }
  | { kind: "failure"; heard: string | null; message: string }
  | { kind: "draft"; heard: string | null; preview: DraftPreview; error: string | undefined }
  | { kind: "created" };

type Phase =
  | { kind: "closed" }
  | { kind: "sending" }
  | { kind: "outcome"; outcome: CommandOutcome; error?: string }
  | { kind: "created" };

type PhaseAtom = Atom<Phase>;

export const sendFailedText = "Не получилось отправить запись. Попробуйте ещё раз.";
export const createFailedText = "Не получилось создать. Попробуйте ещё раз или нажмите «Изменить».";
export const staleDraftText = "Черновик устарел или уже решён — скажите команду ещё раз.";
export const pickFailedText = "Не получилось выбрать. Попробуйте ещё раз.";

function draftOf(phase: Phase): (OpenedDraft & { heard: string | null }) | undefined {
  return phase.kind === "outcome" && phase.outcome.status === "draft"
    ? {
        draftId: phase.outcome.draftId,
        draft: phase.outcome.draft,
        phrase: phase.outcome.phrase,
        heard: phase.outcome.heard,
      }
    : undefined;
}

// The bot words a refused «Создать» the same way; anything else gets the general word.
function refusalTextOf(error: unknown): string {
  const refusal = draftRefusal.safeParse(error instanceof HttpError ? error.code : undefined);

  return refusal.success ? draftRefusalTexts[refusal.data] : createFailedText;
}

function failure(message: string): Phase {
  return { kind: "outcome", outcome: { status: "unrecognized", heard: null, message } };
}

function reatomRequests({ api, onEdit }: CommandSheetDependencies, phase: PhaseAtom) {
  const send = action(async (recording: Blob) => {
    phase.set({ kind: "sending" });

    try {
      phase.set({ kind: "outcome", outcome: await wrap(api.send(recording)) });
    } catch (error) {
      if (isAbort(error)) {
        throw error;
      }

      phase.set(failure(sendFailedText));
    }
  }, "commandSheet.send").extend(withAbort());

  // The bot's «Изменить» arrives as start_param and goes straight to the form.
  const openForEdit = action(async (draftId: string) => {
    try {
      const outcome = await wrap(api.open(draftId));

      if (outcome.status === "draft") {
        onEdit({ draftId, draft: outcome.draft, phrase: outcome.phrase });
      }
    } catch {
      phase.set(failure(staleDraftText));
    }
  }, "commandSheet.openDraft");

  return {
    send: action((recording: Blob) => {
      send(recording).catch(noop);
    }, "commandSheet.sendRecording"),
    stopSending: send.abort,
    openForEdit: action((draftId: string) => {
      openForEdit(draftId).catch(noop);
    }, "commandSheet.openForEdit"),
  };
}

function reatomDecisions({ api, onCreated }: CommandSheetDependencies, phase: PhaseAtom) {
  // Shown as created at once; a refusal brings the draft back with a word on what to do.
  const create = action(async () => {
    const before = phase();
    const opened = draftOf(before);

    if (opened === undefined || before.kind !== "outcome") {
      return;
    }

    phase.set({ kind: "created" });

    try {
      onCreated(await wrap(api.create(opened.draftId)));
    } catch (error) {
      phase.set({ ...before, error: refusalTextOf(error) });
    }
  }, "commandSheet.create");

  const pick = action(async (index: number) => {
    const before = phase();
    const opened = draftOf(before);

    if (opened === undefined || before.kind !== "outcome") {
      return;
    }

    try {
      const outcome = await wrap(api.pick(opened.draftId, index));

      phase.set({ kind: "outcome", outcome: { ...outcome, heard: opened.heard } });
    } catch {
      phase.set({ ...before, error: pickFailedText });
    }
  }, "commandSheet.pick");

  return {
    create: action(() => {
      create().catch(noop);
    }, "commandSheet.createDraft"),
    pick: action((index: number) => {
      pick(index).catch(noop);
    }, "commandSheet.pickCandidate"),
  };
}

function reatomLeaving(
  { api, onEdit }: CommandSheetDependencies,
  { phase, stopSending }: { phase: PhaseAtom; stopSending: () => void },
) {
  return {
    edit: action(() => {
      const opened = draftOf(phase());

      phase.set({ kind: "closed" });

      if (opened !== undefined) {
        onEdit({ draftId: opened.draftId, draft: opened.draft, phrase: opened.phrase });
      }
    }, "commandSheet.edit"),
    // «×» drops a pending draft; once created or failed there is nothing left to drop.
    close: action(() => {
      const opened = draftOf(phase());

      stopSending();
      phase.set({ kind: "closed" });

      if (opened !== undefined) {
        api.dismiss(opened.draftId).catch(noop);
      }
    }, "commandSheet.close"),
  };
}

function sheetOf(current: Phase, names: FamilyNames): CommandSheet {
  if (current.kind !== "outcome") {
    return current;
  }

  const { outcome } = current;

  return outcome.status === "draft"
    ? {
        kind: "draft",
        heard: outcome.heard,
        preview: previewOf(outcome.draft, names),
        error: current.error,
      }
    : { kind: "failure", heard: outcome.heard, message: outcome.message };
}

export function reatomCommandSheet(dependencies: CommandSheetDependencies) {
  const phase = atom<Phase>({ kind: "closed" }, "commandSheet.phase");
  // Pets in care only, as the server offers them to the model.
  const names = computed(async (): Promise<FamilyNames> => {
    const [members, pets] = await wrap(
      Promise.all([dependencies.api.members(), dependencies.api.pets()]),
    );

    return { members, pets: pets.filter(({ archivedAt }) => archivedAt === null) };
  }, "commandSheet.names").extend(withAsyncData());

  const { stopSending, ...requests } = reatomRequests(dependencies, phase);

  return {
    sheet: computed(
      () => sheetOf(phase(), names.data() ?? { members: [], pets: [] }),
      "commandSheet.sheet",
    ),
    ...requests,
    ...reatomDecisions(dependencies, phase),
    ...reatomLeaving(dependencies, { phase, stopSending }),
  };
}

export type CommandSheetModel = ReturnType<typeof reatomCommandSheet>;
