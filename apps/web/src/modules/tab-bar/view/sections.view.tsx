import { reatomComponent } from "@reatom/react";
import { Plus, Settings } from "lucide-react";

import { sectionColors, sectionIcons } from "@/common/sections.config.ts";
import { Chip, chipClass, FilePick, ScreenTitle, Section, SectionItem, cn } from "@/modules/ui";

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

const QuickAdds = reatomComponent(
  ({ model }: { model: SectionsModel }) => (
    <section className="flex flex-col gap-2 px-4 pb-7">
      <h2 className="px-1 text-subhead font-semibold tracking-tight">Быстро добавить</h2>
      <div className="flex flex-wrap gap-2">
        {model.quickAdds().map(({ title, label, target }) => (
          <Chip
            key={target.kind}
            aria-label={label}
            onClick={() => {
              model.quickAdd(target);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {title}
          </Chip>
        ))}
        {model.canAddPhoto() && (
          <FilePick
            className={chipClass(false)}
            aria-label="Добавить фото"
            onPick={model.addPhotos}
          >
            <Plus className="size-4" aria-hidden />
            Фото
          </FilePick>
        )}
      </div>
    </section>
  ),
  "QuickAdds",
);

export const Sections = reatomComponent(
  ({ model }: { model: SectionsModel }) => (
    <>
      <ScreenTitle title="Разделы" />
      <QuickAdds model={model} />
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
