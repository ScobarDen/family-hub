import type { FieldAtom } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";

import type { PickerType } from "@/common/format-date";

import { FieldError } from "./field-error.view.tsx";
import { FieldLabel } from "./field-label.view.tsx";
import { Field } from "./field.view.tsx";
import { PickerInput } from "./picker-input.view.tsx";

type PickerFieldProps = {
  field: FieldAtom<string, string>;
  id: string;
  label: string;
  kind?: PickerType;
  isOptional?: boolean;
};

export const PickerField = reatomComponent(
  ({ field, id, label, kind = "date", isOptional = false }: PickerFieldProps) => {
    const { error, value, onChange, onBlur, onFocus } = bindField(field);
    const isInvalid = error !== undefined;

    return (
      <Field data-invalid={isInvalid}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <PickerInput
          id={id}
          kind={kind}
          value={value}
          onValueChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          aria-invalid={isInvalid}
          {...(isOptional ? { clearLabel: `Очистить «${label}»` } : {})}
        />
        <FieldError>{error}</FieldError>
      </Field>
    );
  },
  "PickerField",
);
