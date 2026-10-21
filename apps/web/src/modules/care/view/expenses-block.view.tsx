import { reatomComponent } from "@reatom/react";
import { ChevronRight, Plus } from "lucide-react";

import { Button, Section } from "@/common/ui";

import type { CareModel } from "../vm/care.vm.ts";
import { ExpenseRows } from "./expense-rows.view.tsx";

export type CareBlockProps = { model: CareModel };

export const ExpensesBlock = reatomComponent(({ model }: CareBlockProps) => {
  const month = model.month();

  return (
    <Section
      title="Траты за месяц"
      aside={
        <button
          type="button"
          className="inline-flex items-center font-medium text-foreground active:opacity-60"
          onClick={model.openExpenses}
        >
          За год <ChevronRight className="size-4" />
        </button>
      }
    >
      <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-3">
        <span className="text-[1.75rem] leading-none tracking-tight">
          {month === undefined || month.rows.length === 0 ? "0 ₽" : month.total}
        </span>
        {!model.isReadOnly() && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              model.add("expense");
            }}
          >
            <Plus /> Трата
          </Button>
        )}
      </div>
      <ExpenseRows rows={month?.rows ?? []} />
    </Section>
  );
}, "ExpensesBlock");
