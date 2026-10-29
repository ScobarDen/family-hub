import { reatomComponent } from "@reatom/react";
import { Wallet } from "lucide-react";

import { PhotoAttachments } from "@/modules/photo-attachments";
import { FormDrawer, Section, SectionItem, SkeletonSection } from "@/modules/ui";

import type { CareModel } from "../vm/care.vm.ts";
import { CareForm } from "./care-form.view.tsx";

export type CareProps = { model: CareModel };

const YearExpenses = reatomComponent(({ model }: CareProps) => {
  const year = model.year();

  if (year === undefined) {
    return <SkeletonSection title="За год" rows={3} />;
  }

  return (
    <>
      <Section title="За год">
        <SectionItem icon={Wallet} title={year.total} />
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

// The journal's own screen, the year's expenses, and the entry form that opens over any screen.
export const Care = reatomComponent(
  ({ model }: CareProps) => (
    <>
      {model.screen().kind === "expenses" && <YearExpenses model={model} />}
      <FormDrawer open={model.isFormOpen()} title={model.formTitle()} onClose={model.back}>
        <CareForm
          model={model.form}
          photos={<PhotoAttachments model={model.attachments} hint={model.photoHint()} />}
          isReadOnly={model.isReadOnly()}
          onCancel={model.back}
          onRemove={model.remove}
        />
      </FormDrawer>
    </>
  ),
  "Care",
);
