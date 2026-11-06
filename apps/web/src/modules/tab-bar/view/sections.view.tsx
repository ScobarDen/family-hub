import { reatomComponent } from "@reatom/react";
import { Settings } from "lucide-react";

import { sectionColors, sectionIcons } from "@/modules/sections";
import { ScreenTitle, Section, SectionItem, cn } from "@/modules/ui";

import type { SectionRow, SectionsModel } from "../vm/sections.vm.ts";

function SectionRows({ model, rows }: { model: SectionsModel; rows: SectionRow[] }) {
  return rows.map(({ module, title }) => {
    const Icon = sectionIcons[module];

    return (
      <SectionItem
        key={module}
        leading={
          <span className="flex size-7 shrink-0 items-center justify-center">
            <Icon className={cn("size-5", sectionColors[module])} strokeWidth={1.75} />
          </span>
        }
        title={title}
        onClick={() => {
          model.open(module);
        }}
      />
    );
  });
}

export const Sections = reatomComponent(
  ({ model }: { model: SectionsModel }) => (
    <>
      <ScreenTitle title="Разделы" />
      <Section
        title="На панели"
        aside={
          <button type="button" className="text-link-text" onClick={model.configure}>
            Настроить панель
          </button>
        }
      >
        <SectionRows model={model} rows={model.slotted()} />
      </Section>
      <Section title="Остальные">
        <SectionRows model={model} rows={model.rest()} />
      </Section>
      <Section>
        <SectionItem icon={Settings} title="Семья и настройки" onClick={model.openSettings} />
      </Section>
    </>
  ),
  "Sections",
);
