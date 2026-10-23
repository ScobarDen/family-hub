import { reatomComponent } from "@reatom/react";
import { Plus, Settings } from "lucide-react";

import { sectionColors, sectionIcons } from "@/common/sections";
import { Chip, FilePick, ScreenTitle, Section, SectionItem, cn } from "@/common/ui";

import type { SectionRow, SectionsModel } from "../vm/sections.vm.ts";

function SectionRows({ model, rows }: { model: SectionsModel; rows: SectionRow[] }) {
  return rows.map(({ module, title, status }) => {
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
        {...(status === undefined ? {} : { subtitle: status })}
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
      <h2 className="px-1 text-[0.9375rem] font-semibold tracking-tight">Быстро добавить</h2>
      <div className="flex flex-wrap gap-2">
        {model.quickAdds().map(({ title, target }) => (
          <Chip
            key={target.kind}
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
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)] px-3.5 text-sm font-medium"
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
          <button type="button" className="text-link" onClick={model.configure}>
            Настроить
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
