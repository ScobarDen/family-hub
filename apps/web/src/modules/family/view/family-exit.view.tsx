import { reatomComponent } from "@reatom/react";
import { LogOut, Trash2 } from "lucide-react";
import type { FormEvent } from "react";

import { Button, FieldError, Section, SectionItem, TextField } from "@/common/ui";

import type { FamilyModel } from "../vm/family.vm.ts";

export type FamilyExitProps = { model: FamilyModel };

const DeletionForm = reatomComponent(({ model }: FamilyExitProps) => {
  const isDeleting = model.isDeleting();

  function submit(event: FormEvent) {
    event.preventDefault();
    model.deleteFamily();
  }

  return (
    <Section
      title="Удаление семьи"
      footer="Удалятся все данные семьи у всех участников. Фото в Telegram-канале семьи бот удалить не может: они останутся там, пока вы не удалите канал сами."
    >
      <form className="flex flex-col gap-3 p-4" onSubmit={submit}>
        <TextField
          field={model.deletion.fields.familyName}
          id="deleted-family-name"
          label="Введите название семьи"
        />
        <FieldError>{model.deletionFailure()}</FieldError>
        <Button type="submit" variant="destructive" disabled={isDeleting}>
          {isDeleting ? "Удаляем…" : "Удалить навсегда"}
        </Button>
        <Button type="button" variant="ghost" onClick={model.closeDeletion}>
          Отмена
        </Button>
      </form>
    </Section>
  );
}, "DeletionForm");

export const FamilyExit = reatomComponent(({ model }: FamilyExitProps) => {
  if (model.isDeletionOpen()) {
    return <DeletionForm model={model} />;
  }

  return (
    <Section footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={LogOut}
        tone="red"
        title="Покинуть семью"
        disabled={model.isBusy()}
        onClick={model.leave}
      />
      {model.canDeleteFamily() && (
        <SectionItem icon={Trash2} tone="red" title="Удалить семью" onClick={model.openDeletion} />
      )}
    </Section>
  );
}, "FamilyExit");
