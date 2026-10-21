import { reatomComponent } from "@reatom/react";
import { NotebookPen, Plus, Scale } from "lucide-react";

import { Chip, Section, SectionItem } from "@/common/ui";

import { weightRanges, type WeightRange } from "../care.config.ts";
import type { CareBlockProps } from "./expenses-block.view.tsx";
import { WeightChart } from "./weight-chart.view.tsx";

const ranges: WeightRange[] = ["quarter", "year", "all"];

const WeightBlock = reatomComponent(({ model }: CareBlockProps) => {
  const weight = model.weight();

  return (
    <Section title="Вес">
      <div className="flex gap-2 px-4 pt-3">
        {ranges.map((range) => (
          <Chip
            key={range}
            isSelected={range === weight.range}
            onClick={() => {
              model.chooseWeightRange(range);
            }}
          >
            {weightRanges[range]}
          </Chip>
        ))}
      </div>
      {weight.points.length > 1 ? (
        <WeightChart points={weight.points} />
      ) : (
        <SectionItem title="Для графика нужно хотя бы два взвешивания" />
      )}
      {!model.isReadOnly() && (
        <SectionItem
          icon={Scale}
          tone="teal"
          title="Записать вес"
          onClick={() => {
            model.add("weight");
          }}
        />
      )}
    </Section>
  );
}, "WeightBlock");

export const JournalBlock = reatomComponent(
  ({ model }: CareBlockProps) => (
    <>
      <WeightBlock model={model} />
      <Section title="Журнал">
        {!model.isReadOnly() && (
          <SectionItem
            icon={Plus}
            tone="green"
            title="Добавить запись"
            onClick={() => {
              model.add("vaccination");
            }}
          />
        )}
        {model.journal().map((item) => (
          <SectionItem
            key={item.id}
            icon={NotebookPen}
            tone="gray"
            title={item.title}
            subtitle={item.note === undefined ? item.subtitle : `${item.subtitle}\n${item.note}`}
            onClick={
              model.isReadOnly()
                ? undefined
                : () => {
                    model.edit(item.id);
                  }
            }
          />
        ))}
      </Section>
    </>
  ),
  "JournalBlock",
);
