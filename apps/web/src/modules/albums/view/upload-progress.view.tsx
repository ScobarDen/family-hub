import { reatomComponent } from "@reatom/react";
import { RotateCw, Upload } from "lucide-react";

import { LiveRegion, Section, SectionItem } from "@/common/ui";

import type { BatchUploadModel } from "../vm/batch-upload.vm.ts";

export const UploadProgress = reatomComponent(({ model }: { model: BatchUploadModel }) => {
  const failed = model.failedCount();

  return (
    <>
      <LiveRegion className="sr-only">
        {model.isActive() && [model.title(), model.failedNote()].filter(Boolean).join(". ")}
      </LiveRegion>
      {model.isActive() && (
        <Section
          footer={
            model.isRunning() ? "Не закрывайте приложение, пока фото загружаются." : undefined
          }
        >
          <SectionItem icon={Upload} title={model.title()} subtitle={model.failedNote()} />
          {failed > 0 && !model.isRunning() && (
            <SectionItem icon={RotateCw} title="Повторить" onClick={model.retry} />
          )}
        </Section>
      )}
    </>
  );
}, "UploadProgress");
