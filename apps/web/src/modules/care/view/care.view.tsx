import { reatomComponent } from "@reatom/react";
import { Wallet } from "lucide-react";

import { FieldError, Section, SectionItem } from "@/common/ui";

import type { CareModel } from "../vm/care.vm.ts";
import { CareForm } from "./care-form.view.tsx";
import { PhotoAttachments } from "./photo-attachments.view.tsx";

export type CareProps = { model: CareModel };

const YearExpenses = reatomComponent(({ model }: CareProps) => {
  const year = model.year();

  if (year === undefined) {
    return (
      <Section>
        <SectionItem title="Загружаем…" />
      </Section>
    );
  }

  return (
    <>
      <Section title="За год">
        <SectionItem icon={Wallet} tone="green" title={year.total} />
        {year.rows.map((row) => (
          <SectionItem key={row.title} title={row.title} after={row.amount} />
        ))}
      </Section>
      <Section title="Все траты">
        {year.entries.map((entry) => (
          <SectionItem
            key={entry.id}
            title={entry.title}
            subtitle={entry.subtitle}
            after={entry.amount}
            onClick={
              model.isReadOnly()
                ? undefined
                : () => {
                    model.edit(entry.id);
                  }
            }
          />
        ))}
      </Section>
    </>
  );
}, "YearExpenses");

// The journal's own screens: an entry form or the year's expenses, over the pet card.
export const Care = reatomComponent(({ model }: CareProps) => {
  const screen = model.screen();

  if (screen.kind === "expenses") {
    return <YearExpenses model={model} />;
  }

  return (
    <>
      <CareForm
        model={model.form}
        photos={<PhotoAttachments model={model.attachments} hint={model.photoHint()} />}
        onCancel={model.back}
        onRemove={model.remove}
      />
      <div className="px-4">
        <FieldError>{model.failure()}</FieldError>
      </div>
    </>
  );
}, "Care");
