import { reatomComponent } from "@reatom/react";

import type { CareModel } from "../vm/care.vm.ts";

// The facts a Member checks most often lead the pet card.
export const CareSummary = reatomComponent(({ model }: { model: CareModel }) => {
  const { weight, vetVisit, monthExpenses } = model.summary();
  const facts = [
    { label: "Вес", value: weight ?? "—" },
    { label: "Визит к ветеринару", value: vetVisit ?? "—" },
    { label: "Траты за месяц", value: monthExpenses },
  ];

  return (
    <dl className="mx-4 mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 text-card-foreground">
      {facts.map(({ label, value }) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
          <dd className="mt-auto text-xl leading-tight font-semibold break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}, "CareSummary");
