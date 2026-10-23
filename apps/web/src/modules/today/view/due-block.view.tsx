import { reatomComponent } from "@reatom/react";
import { ChevronRight } from "lucide-react";

import { sectionIcons } from "@/common/sections";
import { CheckButton, Section, SectionItem } from "@/common/ui";

import type { DueRow } from "../today.lib.ts";
import type { TodayModel } from "../vm/today.vm.ts";

type RowProps = { row: DueRow; model: TodayModel };

function DueItem({ row, model }: RowProps) {
  function act() {
    model.completeOrRecord(row.key);
  }

  function open() {
    model.openItem(row.key);
  }

  // A Plan closes with the circle at its start and opens from the rest of the row; a Due Date
  // opens its Care Entry form from the whole row, anything else opens itself.
  return row.action?.kind === "complete" ? (
    <SectionItem
      control={
        <CheckButton
          label={`${row.action.title}: ${row.title}`}
          isAlert={row.isOverdue}
          onClick={act}
        />
      }
      title={row.title}
      subtitle={row.when}
      onClick={open}
    />
  ) : (
    <SectionItem
      icon={sectionIcons[row.module]}
      isAlert={row.isOverdue}
      title={row.title}
      subtitle={row.when}
      {...(row.action === undefined
        ? {}
        : { after: <span className="text-[0.9375rem] text-link-text">{row.action.title}</span> })}
      onClick={row.action === undefined ? open : act}
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
