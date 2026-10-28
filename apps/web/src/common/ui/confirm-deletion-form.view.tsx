import type { FieldAtom } from "@reatom/core";
import type { FormEvent, ReactNode } from "react";

import { Button } from "./button.view.tsx";
import { FieldError } from "./field-error.view.tsx";
import { LiveRegion } from "./live-region.view.tsx";
import { Section } from "./section.view.tsx";
import { TextField } from "./text-field.view.tsx";

type ConfirmDeletionFormProps = {
  title?: string;
  warning: ReactNode;
  // The name typed back before anything is deleted forever.
  field: FieldAtom<string, string>;
  id: string;
  label: string;
  failure: string | undefined;
  isDeleting: boolean;
  onDelete: () => void;
  onCancel: () => void;
};

export function ConfirmDeletionForm(props: ConfirmDeletionFormProps) {
  const { title, warning, field, id, label, failure, isDeleting, onDelete, onCancel } = props;

  function submit(event: FormEvent) {
    event.preventDefault();
    onDelete();
  }

  return (
    <Section {...(title === undefined ? {} : { title })} footer={warning}>
      <form className="flex flex-col gap-3 p-4" onSubmit={submit}>
        <TextField field={field} id={id} label={label} />
        <LiveRegion>
          <FieldError>{failure}</FieldError>
        </LiveRegion>
        <Button type="submit" variant="destructive" isPending={isDeleting}>
          Удалить навсегда
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </form>
    </Section>
  );
}
