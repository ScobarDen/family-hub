import { reatomComponent } from "@reatom/react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "./button.view.tsx";
import { FieldError } from "./field-error.view.tsx";

type Savable = {
  save: () => void;
  isSaving: () => boolean;
  failure: () => string | undefined;
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

    function submit(event: FormEvent) {
      event.preventDefault();
      model.save();
    }

    return (
      <form className="flex flex-col gap-4 px-5 pb-6" onSubmit={submit}>
        {children}
        <FieldError>{model.failure()}</FieldError>
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
