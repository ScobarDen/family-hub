import { reatomComponent } from "@reatom/react";
import { LoaderCircle, RotateCw } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { BatchUploadModel } from "../vm/batch-upload.vm.ts";

export const UploadProgress = reatomComponent(({ model }: { model: BatchUploadModel }) => {
  if (!model.isActive()) {
    return null;
  }

  const failed = model.failedCount();

  return (
    <Section
      footer={model.isRunning() ? "Не закрывайте приложение, пока фото загружаются." : undefined}
    >
      <SectionItem icon={LoaderCircle} title={model.title()} subtitle={model.failedNote()} />
      {failed > 0 && !model.isRunning() && (
        <SectionItem icon={RotateCw} title="Повторить" onClick={model.retry} />
      )}
    </Section>
  );
}, "UploadProgress");
