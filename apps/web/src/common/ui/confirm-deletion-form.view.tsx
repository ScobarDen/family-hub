import type { FieldAtom } from "@reatom/core";
import type { FormEvent, ReactNode } from "react";

import { Button } from "./button.view.tsx";
import { FieldError } from "./field-error.view.tsx";
import { LiveRegion } from "./live-region.view.tsx";
import { TextField } from "./text-field.view.tsx";

type ConfirmDeletionFormProps = {
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
  const { warning, field, id, label, failure, isDeleting, onDelete, onCancel } = props;

  function submit(event: FormEvent) {
    event.preventDefault();
    onDelete();
  }

  return (
    <form className="flex flex-col gap-4 px-5 pb-6" onSubmit={submit}>
      <p className="text-subhead text-muted-foreground">{warning}</p>
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
  );
}
