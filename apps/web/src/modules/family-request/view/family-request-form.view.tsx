import { bindField, reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, Field, FieldError, FieldLabel, Input, Notice } from "@/common/ui";

import type { FamilyRequestModel } from "../vm/family-request.vm.ts";

type FamilyRequestFormProps = { model: FamilyRequestModel };

export const FamilyRequestForm = reatomComponent(({ model }: FamilyRequestFormProps) => {
  const { error, ...familyName } = bindField(model.form.fields.familyName);
  const isSubmitting = model.isSubmitting();

  function submit(event: FormEvent) {
    event.preventDefault();
    model.submit();
  }

  return (
    <Notice
      title="Своя семья"
      description="Operator рассмотрит заявку, а бот пришлёт ответ в Telegram."
    >
      <form className="flex w-full max-w-xs flex-col gap-3 text-left" onSubmit={submit}>
        <Field data-invalid={error !== undefined}>
          <FieldLabel htmlFor="family-name">Название семьи</FieldLabel>
          <Input
            id="family-name"
            placeholder="Например, Гущины"
            autoComplete="off"
            aria-invalid={error !== undefined}
            {...familyName}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <FieldError>{model.failure()}</FieldError>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Отправляем…" : "Отправить заявку"}
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={model.back}>
          Назад
        </Button>
      </form>
    </Notice>
  );
}, "FamilyRequestForm");
