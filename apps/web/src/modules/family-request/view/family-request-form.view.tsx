import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, FieldError, Notice, TextField } from "@/common/ui";

import type { FamilyRequestModel } from "../vm/family-request.vm.ts";

type FamilyRequestFormProps = { model: FamilyRequestModel };

export const FamilyRequestForm = reatomComponent(({ model }: FamilyRequestFormProps) => {
  const isSubmitting = model.isSubmitting();

  function submit(event: FormEvent) {
    event.preventDefault();
    model.submit();
  }

  return (
    <Notice
      title="Своя семья"
      description="Администратор рассмотрит заявку, а бот пришлёт ответ в Telegram."
    >
      <form className="flex w-full max-w-xs flex-col gap-3 text-left" onSubmit={submit}>
        <TextField
          field={model.form.fields.familyName}
          id="family-name"
          label="Название семьи"
          placeholder="Например, Гущины"
        />
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
