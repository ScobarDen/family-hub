import type { FieldAtom } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";
import type { ComponentProps } from "react";

import { FieldError } from "./field-error.view.tsx";
import { FieldLabel } from "./field-label.view.tsx";
import { Field } from "./field.view.tsx";
import { Input } from "./input.view.tsx";

type TextFieldProps = {
  field: FieldAtom<string, string>;
  id: string;
  label: string;
  placeholder?: string;
  inputMode?: ComponentProps<"input">["inputMode"];
};

export const TextField = reatomComponent(
  ({ field, id, label, placeholder, inputMode }: TextFieldProps) => {
    const { error, ...input } = bindField(field);
    const isInvalid = error !== undefined;

    return (
      <Field data-invalid={isInvalid}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          id={id}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete="off"
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? `${id}-error` : undefined}
          {...input}
        />
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </Field>
    );
  },
  "TextField",
);
