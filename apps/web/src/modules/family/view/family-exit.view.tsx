import { reatomComponent } from "@reatom/react";
import { LogOut, Trash2 } from "lucide-react";

import { ConfirmDeletionForm, FieldError, Section, SectionItem } from "@/common/ui";

import type { FamilyModel } from "../vm/family.vm.ts";

export type FamilyExitProps = { model: FamilyModel };

const DeletionForm = reatomComponent(
  ({ model }: FamilyExitProps) => (
    <ConfirmDeletionForm
      title="Удаление семьи"
      warning="Удалятся все данные семьи у всех участников. Фото в Telegram-канале семьи бот удалить не может: они останутся там, пока вы не удалите канал сами."
      field={model.deletion.fields.familyName}
      id="deleted-family-name"
      label="Введите название семьи"
      failure={model.deletionFailure()}
      isDeleting={model.isDeleting()}
      onDelete={model.deleteFamily}
      onCancel={model.closeDeletion}
    />
  ),
  "DeletionForm",
);

export const FamilyExit = reatomComponent(({ model }: FamilyExitProps) => {
  if (model.isDeletionOpen()) {
    return <DeletionForm model={model} />;
  }

  return (
    <Section footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={LogOut}
        isAlert
        title="Покинуть семью"
        disabled={model.isBusy()}
        onClick={model.leave}
      />
      {model.canDeleteFamily() && (
        <SectionItem
          icon={Trash2}
          isDestructive
          title="Удалить семью"
          onClick={model.openDeletion}
        />
      )}
    </Section>
  );
}, "FamilyExit");
