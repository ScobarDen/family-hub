import { reatomComponent } from "@reatom/react";
import { Images } from "lucide-react";

import { Section, SectionItem } from "@/modules/ui";

import type { PhotoStorageModel } from "./vm/photo-storage.vm.ts";

export type PhotoStorageProps = { model: PhotoStorageModel };

export const PhotoStorage = reatomComponent(({ model }: PhotoStorageProps) => {
  const view = model.view();

  if (view === undefined) {
    return null;
  }

  return (
    <Section title="Хранилище фото" footer={view.description}>
      <SectionItem icon={Images} title={view.title} />
    </Section>
  );
}, "PhotoStorage");
