type Fillable<Values> = {
  init: (values: Values) => void;
  fieldsList: () => Array<{ reset: () => void }>;
};

// The form's own reset would also abort its next submit, so the fields are reset one by one.
export function fill<Values>(form: Fillable<Values>, values: Values): void {
  form.init(values);

  for (const field of form.fieldsList()) {
    field.reset();
  }
}
