import { reatomComponent } from "@reatom/react";
import { Plus, Wallet } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { CareModel } from "../vm/care.vm.ts";

export type CareBlockProps = { model: CareModel };

export const ExpensesBlock = reatomComponent(({ model }: CareBlockProps) => {
  const month = model.month();

  return (
    <Section title="Траты за месяц">
      <SectionItem
        icon={Wallet}
        tone="green"
        title={month === undefined || month.rows.length === 0 ? "Трат пока нет" : month.total}
        subtitle="Все траты за год"
        onClick={model.openExpenses}
      />
      {month?.rows.map((row) => (
        <SectionItem key={row.title} title={row.title} after={row.amount} />
      ))}
      <SectionItem
        icon={Plus}
        tone="green"
        title="Добавить трату"
        onClick={() => {
          model.add("expense");
        }}
      />
    </Section>
  );
}, "ExpensesBlock");
