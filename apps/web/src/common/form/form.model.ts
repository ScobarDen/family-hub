import { action, atom, computed, noop, wrap, type Atom } from "@reatom/core";

import type { CommandPhrase } from "@family-hub/contract";

type Fillable<Values> = {
  init: (values: Values) => void;
  fieldsList: () => Array<{ reset: () => void }>;
};

// A Reatom form's own reset also aborts its next submit, so the fields are reset one by one.
export function fillForm<Values>(form: Fillable<Values>, values: Values): void {
  form.init(values);

  for (const field of form.fieldsList()) {
    field.reset();
  }
}

type Submittable = {
  submit: { error: () => unknown };
  validation: () => { errors: unknown[] };
};

// A submit that failed with valid fields was refused by the server or the network.
export function reatomSubmitFailure(
  form: Submittable,
  { message, name }: { message: string; name: string },
) {
  return computed((): string | undefined => {
    const isRejectedByServer =
      form.submit.error() !== undefined && form.validation().errors.length === 0;

    return isRejectedByServer ? message : undefined;
  }, name);
}

type Mode<Edited> =
  | { kind: "creating" }
  | { kind: "editing"; edited: Edited }
  | { kind: "drafting"; draftId: string };

export type DraftOpening<Draft> = { draftId: string; draft: Draft; phrase: CommandPhrase };

type RecordForm<Values> = Fillable<Values> &
  Submittable & { submit: (() => Promise<unknown>) & { ready: () => boolean } };

export type EditableRecordOptions<Values, Form extends RecordForm<Values>, Edited, Draft, Saved> = {
  name: string;
  // The module builds its own reatomForm around this submit, so its fields keep their types.
  form: (onSubmit: (values: Values) => Promise<void>) => Form;
  failureMessage: string;
  valuesOf: (edited: Edited) => Values;
  valuesOfDraft: (draft: Draft, phrase: CommandPhrase) => Values;
  create: (values: Values) => Promise<Saved>;
  update: (edited: Edited, values: Values) => Promise<Saved>;
  onSaved: (saved: Saved) => void;
  // A record saved from a draft settles that draft, once.
  onDraftSaved?: (draftId: string) => void;
};

function submitWith<Values, Form extends RecordForm<Values>, Edited, Draft, Saved>(
  options: EditableRecordOptions<Values, Form, Edited, Draft, Saved>,
  mode: Atom<Mode<Edited>>,
) {
  return async (values: Values): Promise<void> => {
    const current = mode();
    const saved = await wrap(
      current.kind === "editing" ? options.update(current.edited, values) : options.create(values),
    );

    if (current.kind === "drafting") {
      mode.set({ kind: "creating" });
      options.onDraftSaved?.(current.draftId);
    }

    options.onSaved(saved);
  };
}

function reatomStarts<Values, Form extends RecordForm<Values>, Edited, Draft, Saved>(
  options: EditableRecordOptions<Values, Form, Edited, Draft, Saved>,
  { mode, form }: { mode: Atom<Mode<Edited>>; form: Form },
) {
  const { name } = options;

  function start(next: Mode<Edited>, values: Values): void {
    mode.set(next);
    fillForm(form, values);
  }

  return {
    startCreating: action((values: Values) => {
      start({ kind: "creating" }, values);
    }, `${name}.startCreating`),
    startEditing: action((edited: Edited) => {
      start({ kind: "editing", edited }, options.valuesOf(edited));
    }, `${name}.startEditing`),
    startFromDraft: action(({ draftId, draft, phrase }: DraftOpening<Draft>) => {
      start({ kind: "drafting", draftId }, options.valuesOfDraft(draft, phrase));
    }, `${name}.startFromDraft`),
  };
}

export function reatomEditableRecord<Values, Form extends RecordForm<Values>, Edited, Draft, Saved>(
  options: EditableRecordOptions<Values, Form, Edited, Draft, Saved>,
) {
  const { name } = options;
  const mode = atom<Mode<Edited>>({ kind: "creating" }, `${name}.mode`);
  const form = options.form(submitWith(options, mode));

  return {
    form,
    edited: computed(() => {
      const current = mode();

      return current.kind === "editing" ? current.edited : undefined;
    }, `${name}.edited`),
    isCreating: computed(() => mode().kind !== "editing", `${name}.isCreating`),
    isSaving: computed(() => !form.submit.ready(), `${name}.isSaving`),
    failure: reatomSubmitFailure(form, {
      message: options.failureMessage,
      name: `${name}.failure`,
    }),
    ...reatomStarts(options, { mode, form }),
    save: action(() => {
      form.submit().catch(noop);
    }, `${name}.save`),
  };
}
