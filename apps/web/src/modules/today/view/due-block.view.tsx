import { reatomComponent } from "@reatom/react";
import { ChevronRight } from "lucide-react";

import { sectionIcons } from "@/common/sections";
import { CheckButton, Section, SectionItem } from "@/common/ui";

import type { DueRow } from "../today.lib.ts";
import type { TodayModel } from "../vm/today.vm.ts";

type RowProps = { row: DueRow; model: TodayModel };

// A Task closes with the circle at its start and opens from the rest of the row; a birthday
// only opens.
function DueItem({ row, model }: RowProps) {
  function open() {
    model.openItem(row.key);
  }

  return row.canComplete ? (
    <SectionItem
      control={
        <CheckButton
          label={`Отметить выполненным: ${row.title}`}
          isAlert={row.isOverdue}
          onClick={() => {
            model.complete(row.key);
          }}
        />
      }
      title={row.title}
      subtitle={row.when}
      onClick={open}
    />
  ) : (
    <SectionItem
      icon={sectionIcons[row.module]}
      picture={row.picture}
      isAlert={row.isOverdue}
      title={row.title}
      subtitle={row.when}
      onClick={open}
    />
  );
}

// The card goes away when nothing is on today; the header already says the day is free.
export const DueBlock = reatomComponent(({ model }: { model: TodayModel }) => {
  const rows = model.rows();
  const more = model.more();

  if (rows.length === 0) {
    return null;
  }

  return (
    <Section title="Сделать сегодня">
      {rows.map((row) => (
        <DueItem key={row.key} row={row} model={model} />
      ))}
      {more !== undefined && (
        <SectionItem
          title={more}
          after={<ChevronRight className="size-4 text-muted-foreground" />}
          onClick={model.openFeed}
        />
      )}
    </Section>
  );
}, "DueBlock");
