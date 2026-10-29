import { reatomComponent } from "@reatom/react";
import { AppWindow } from "lucide-react";

import { Button, SectionItem } from "@/modules/ui";

import type { InstallEntryModel } from "../vm/install-entry.vm.ts";

export type InstallEntryProps = { model: InstallEntryModel };

export const InstallEntry = reatomComponent(({ model }: InstallEntryProps) => {
  if (!model.isShown) {
    return null;
  }

  return (
    <SectionItem
      icon={AppWindow}
      title="Установить как приложение"
      subtitle="Отдельный значок и Push, без Telegram"
      after={
        <Button size="sm" onClick={model.open}>
          Установить
        </Button>
      }
    />
  );
}, "InstallEntry");
