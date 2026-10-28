import { reatomComponent } from "@reatom/react";
import { useEffect, type FormEvent, type ReactNode } from "react";

import { Button } from "./button.view.tsx";
import { FieldError } from "./field-error.view.tsx";
import { LiveRegion } from "./live-region.view.tsx";
import { useFocusOnInvalid } from "./ui.lib.ts";

type Savable = {
  form: { submit: { error: () => unknown } };
  save: () => void;
  isSaving: () => boolean;
  failure: () => string | undefined;
  confirmClosingWhileDirty?: () => () => void;
};

type FormShellProps = {
  model: Savable;
  onCancel: () => void;
  // Buttons of the record's own, such as «Удалить», between «Сохранить» and «Отмена».
  actions?: ReactNode;
  children: ReactNode;
};

export const FormShell = reatomComponent(
  ({ model, onCancel, actions, children }: FormShellProps) => {
    const isSaving = model.isSaving();

    const form = useFocusOnInvalid(model.form.submit.error());

    useEffect(() => model.confirmClosingWhileDirty?.(), [model]);

    function submit(event: FormEvent) {
      event.preventDefault();
      model.save();
    }

    return (
      <form ref={form} className="flex flex-col gap-4 px-5 pb-6" onSubmit={submit}>
        {children}
        <LiveRegion>
          <FieldError>{model.failure()}</FieldError>
        </LiveRegion>
        <Button type="submit" size="lg" isPending={isSaving}>
          Сохранить
        </Button>
        {actions}
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </form>
    );
  },
  "FormShell",
);
