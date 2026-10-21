import { reatomComponent } from "@reatom/react";
import { Archive, ArchiveRestore, PawPrint, Trash2 } from "lucide-react";

import { FieldError, Section, SectionItem } from "@/common/ui";

import type { PetsScreen, PetsScreenModel } from "../vm/pets.vm.ts";

type PetArchiveSectionProps = {
  screen: Extract<PetsScreen, { kind: "card" }>;
  model: PetsScreenModel;
};

export const PetArchiveSection = reatomComponent(({ screen, model }: PetArchiveSectionProps) => {
  const { isArchived } = screen.card;

  return (
    <Section footer={<FieldError>{model.archiveFailure()}</FieldError>}>
      {!isArchived && screen.archivedCount > 0 && (
        <SectionItem
          icon={PawPrint}
          tone="gray"
          title={`Все питомцы · в архиве ${screen.archivedCount}`}
          onClick={model.showAll}
        />
      )}
      <SectionItem
        icon={isArchived ? ArchiveRestore : Archive}
        tone="gray"
        title={isArchived ? "Вернуть из архива" : "Перенести в архив"}
        subtitle={isArchived ? undefined : "История останется, напоминания прекратятся"}
        onClick={model.toggleArchive}
      />
      {screen.canDelete && (
        <SectionItem
          icon={Trash2}
          tone="red"
          title="Удалить навсегда"
          onClick={model.startDeleting}
        />
      )}
    </Section>
  );
}, "PetArchiveSection");
