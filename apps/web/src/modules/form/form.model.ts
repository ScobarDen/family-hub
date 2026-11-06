import {
  action,
  atom,
  computed,
  effect,
  noop,
  reatomBoolean,
  withCallHook,
  wrap,
  type Action,
  type Atom,
  type Computed,
} from "@reatom/core";

import { detached } from "@/modules/changes";
import {
  isConfirmed,
  type ClosingConfirmation,
  type Dialogs,
  type Haptics,
} from "@/modules/telegram";

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
  submit: { error: () => unknown; onReject: Action };
  validation: () => { errors: unknown[] };
};

// A submit that failed with valid fields was refused by the server or the network; either way,
// and for a field that needs fixing, the Member feels an error.
export function reatomSubmitFailure(
  form: Submittable,
  { message, name, haptics }: { message: string; name: string; haptics: Pick<Haptics, "error"> },
) {
  form.submit.onReject.extend(
    withCallHook(() => {
      haptics.error();
    }),
  );

  return computed((): string | undefined => {
    const isRejectedByServer =
      form.submit.error() !== undefined && form.validation().errors.length === 0;

    return isRejectedByServer ? message : undefined;
  }, name);
}

type Mode<Edited> = { kind: "creating" } | { kind: "editing"; edited: Edited };

type RecordForm<Values> = Fillable<Values> &
  Submittable & {
    submit: (() => Promise<unknown>) & { ready: () => boolean };
    focus: () => { dirty: boolean };
  };

export type EditableRecordOptions<Values, Form extends RecordForm<Values>, Edited, Saved> = {
  name: string;
  // The module builds its own reatomForm around this submit, so its fields keep their types.
  form: (onSubmit: (values: Values) => Promise<void>) => Form;
  failureMessage: string;
  haptics: Pick<Haptics, "success" | "error">;
  closingConfirmation: ClosingConfirmation;
  valuesOf: (edited: Edited) => Values;
  create: (values: Values) => Promise<Saved>;
  update: (edited: Edited, values: Values) => Promise<Saved>;
  onSaved: (saved: Saved) => void;
};

export type EditableRecord<Values, Form, Edited> = {
  form: Form;
  edited: Computed<Edited | undefined>;
  isCreating: Computed<boolean>;
  isSaving: Computed<boolean>;
  failure: Computed<string | undefined>;
  startCreating: Action<[values: Values], void>;
  startEditing: Action<[edited: Edited], void>;
  save: Action<[], void>;
  // The form's View holds it while on screen, so leaving the form drops the confirmation too.
  confirmClosingWhileDirty: () => () => void;
};

function submitWith<Values, Form extends RecordForm<Values>, Edited, Saved>(
  options: EditableRecordOptions<Values, Form, Edited, Saved>,
  mode: Atom<Mode<Edited>>,
  onDone: () => void,
) {
  return async (values: Values): Promise<void> => {
    const current = mode();
    const saved = await wrap(
      current.kind === "editing" ? options.update(current.edited, values) : options.create(values),
    );

    onDone();
    options.onSaved(saved);
  };
}

function reatomSave(
  form: { submit: RecordForm<unknown>["submit"] },
  { name, haptics }: { name: string; haptics: Pick<Haptics, "success"> },
) {
  return action(() => {
    if (!form.submit.ready()) {
      return;
    }

    form.submit().then(haptics.success, noop);
  }, `${name}.save`);
}

function confirmingClosing(
  telegram: ClosingConfirmation,
  { name, isUnsaved }: { name: string; isUnsaved: () => boolean },
) {
  return () => {
    const following = effect(() => {
      if (isUnsaved()) {
        telegram.enableClosingConfirmation();
      } else {
        telegram.disableClosingConfirmation();
      }
    }, `${name}.closingConfirmation`);

    return () => {
      following.unsubscribe();
      telegram.disableClosingConfirmation();
    };
  };
}

type Discarding = Pick<ClosingConfirmation, "isClosingConfirmationEnabled"> &
  Pick<Dialogs, "showPopup"> & { haptics: Pick<Haptics, "warning"> };

// A swipe, the overlay, Escape, «Отмена» and Telegram Back all close a form through its module's
// back, so closing one that holds unsaved input asks there once for all of them.
export function reatomFormBack({
  name,
  telegram,
  isFormOpen,
  back,
}: {
  name: string;
  telegram: Discarding;
  isFormOpen: () => boolean;
  back: () => void;
}) {
  return detached(async () => {
    const isUnsaved = isFormOpen() && telegram.isClosingConfirmationEnabled();

    if (
      isUnsaved &&
      !(await wrap(
        isConfirmed(telegram, {
          title: "Отменить изменения?",
          message: "Введённое в форме не сохранится.",
          button: "Не сохранять",
        }),
      ))
    ) {
      return;
    }

    back();
  }, name);
}

export function reatomEditableRecord<Values, Form extends RecordForm<Values>, Edited, Saved>(
  options: EditableRecordOptions<Values, Form, Edited, Saved>,
): EditableRecord<Values, Form, Edited> {
  const { name } = options;
  const mode = atom<Mode<Edited>>({ kind: "creating" }, `${name}.mode`);
  const isSaved = reatomBoolean(false, `${name}.isSaved`);
  const form = options.form(submitWith(options, mode, isSaved.setTrue));
  const isUnsaved = computed(() => form.focus().dirty && !isSaved(), `${name}.isUnsaved`);

  function start(next: Mode<Edited>, values: Values): void {
    mode.set(next);
    isSaved.setFalse();
    fillForm(form, values);
  }

  return {
    form,
    edited: computed(() => {
      const current = mode();

      return current.kind === "editing" ? current.edited : undefined;
    }, `${name}.edited`),
    isCreating: computed(() => mode().kind === "creating", `${name}.isCreating`),
    isSaving: computed(() => !form.submit.ready(), `${name}.isSaving`),
    failure: reatomSubmitFailure(form, {
      message: options.failureMessage,
      name: `${name}.failure`,
      haptics: options.haptics,
    }),
    startCreating: action((values: Values) => {
      start({ kind: "creating" }, values);
    }, `${name}.startCreating`),
    startEditing: action((edited: Edited) => {
      start({ kind: "editing", edited }, options.valuesOf(edited));
    }, `${name}.startEditing`),
    save: reatomSave(form, { name, haptics: options.haptics }),
    confirmClosingWhileDirty: confirmingClosing(options.closingConfirmation, { name, isUnsaved }),
  };
}
