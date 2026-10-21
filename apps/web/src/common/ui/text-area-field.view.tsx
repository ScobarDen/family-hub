import type { FieldAtom } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";

import { FieldError } from "./field-error.view.tsx";
import { FieldLabel } from "./field-label.view.tsx";
import { Field } from "./field.view.tsx";
import { Textarea } from "./textarea.view.tsx";

type TextAreaFieldProps = {
  field: FieldAtom<string, string>;
  id: string;
  label: string;
  placeholder?: string;
};

export const TextAreaField = reatomComponent(
  ({ field, id, label, placeholder }: TextAreaFieldProps) => {
    const { error, ...textarea } = bindField(field);
    const isInvalid = error !== undefined;

    return (
      <Field data-invalid={isInvalid}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Textarea id={id} placeholder={placeholder} aria-invalid={isInvalid} {...textarea} />
        <FieldError>{error}</FieldError>
      </Field>
    );
  },
  "TextAreaField",
);
