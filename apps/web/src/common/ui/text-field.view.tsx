import type { FieldAtom } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";

import { FieldError } from "./field-error.view.tsx";
import { FieldLabel } from "./field-label.view.tsx";
import { Field } from "./field.view.tsx";
import { Input } from "./input.view.tsx";

type TextFieldProps = {
  field: FieldAtom<string, string>;
  id: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date" | "datetime-local";
};

export const TextField = reatomComponent(
  ({ field, id, label, placeholder, type = "text" }: TextFieldProps) => {
    const { error, ...input } = bindField(field);
    const isInvalid = error !== undefined;

    return (
      <Field data-invalid={isInvalid}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={isInvalid}
          {...input}
        />
        <FieldError>{error}</FieldError>
      </Field>
    );
  },
  "TextField",
);
