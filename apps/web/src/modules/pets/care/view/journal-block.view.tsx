import { reatomComponent } from "@reatom/react";
import { Fragment } from "react";

import { PhotoThumbs } from "@/common/photo-viewer";
import { Chip, Section, SectionItem } from "@/common/ui";

import { weightRanges, type WeightRange } from "../care.config.ts";
import type { CareModel } from "../vm/care.vm.ts";
import { WeightChart } from "./weight-chart.view.tsx";
import { WeightHeader } from "./weight-header.view.tsx";

const ranges: WeightRange[] = ["quarter", "year", "all"];

const WeightBlock = reatomComponent(({ model }: { model: CareModel }) => {
  const weight = model.weight();

  return (
    <Section title="Вес">
      <WeightHeader model={model} />
      <div className="flex gap-1.5 px-4 pt-4">
        {ranges.map((range) => (
          <Chip
            key={range}
            className="min-h-7 px-3 py-1 text-footnote"
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
        <p className="px-4 py-4 text-subhead text-muted-foreground">
          Для графика нужно хотя бы два взвешивания
        </p>
      )}
    </Section>
  );
}, "WeightBlock");

export const JournalBlock = reatomComponent(
  ({ model }: { model: CareModel }) => (
    <>
      <WeightBlock model={model} />
      <Section title="Журнал">
        {model.journal().map((item) => (
          <Fragment key={item.id}>
            <SectionItem
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
            <PhotoThumbs
              className="flex flex-wrap gap-1 px-4 pb-2"
              thumbClassName="size-16 rounded-md"
              photos={item.photos}
              onOpen={(photoId) => {
                model.viewer.open(item.photos, photoId);
              }}
            />
          </Fragment>
        ))}
      </Section>
    </>
  ),
  "JournalBlock",
);
