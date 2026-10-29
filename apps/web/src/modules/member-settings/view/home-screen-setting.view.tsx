import { reatomComponent } from "@reatom/react";
import { Smartphone } from "lucide-react";

import { Button, SectionItem } from "@/modules/ui";

import type { HomeScreenModel } from "../vm/home-screen.vm.ts";

export type HomeScreenSettingProps = { model: HomeScreenModel };

export const HomeScreenSetting = reatomComponent(({ model }: HomeScreenSettingProps) => {
  const entry = model.entry();

  if (entry === undefined) {
    return null;
  }

  return (
    <SectionItem
      icon={Smartphone}
      title="Значок на экране «Домой»"
      subtitle={entry.isAdded ? "Уже добавлен" : "Открывайте как приложение"}
      after={
        !entry.isAdded && (
          <Button size="sm" onClick={model.add}>
            Добавить
          </Button>
        )
      }
    />
  );
}, "HomeScreenSetting");
