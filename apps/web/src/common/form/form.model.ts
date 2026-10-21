import { computed } from "@reatom/core";

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
  submit: { error: () => unknown };
  validation: () => { errors: unknown[] };
};

// A submit that failed with valid fields was refused by the server or the network.
export function reatomSubmitFailure(
  form: Submittable,
  { message, name }: { message: string; name: string },
) {
  return computed((): string | undefined => {
    const isRejectedByServer =
      form.submit.error() !== undefined && form.validation().errors.length === 0;

    return isRejectedByServer ? message : undefined;
  }, name);
}
