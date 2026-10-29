import { reatomComponent } from "@reatom/react";
import { ChevronRight } from "lucide-react";

import { sectionIcons } from "@/common/sections.config.ts";
import { CheckButton, cn, Section, SectionItem, SkeletonSection } from "@/modules/ui";

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
          isChecked={row.isDone}
          isAlert={row.isOverdue && !row.isDone}
          onClick={() => {
            model.complete(row.key);
          }}
        />
      }
      title={row.title}
      subtitle={row.when}
      onClick={open}
      isCollapsed={row.isDone}
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

  if (model.isDueOutdated()) {
    return <SkeletonSection title="Сделать сегодня" rows={2} />;
  }

  if (rows.length === 0) {
    return null;
  }

  const isAllDone = rows.every(({ isDone }) => isDone);

  return (
    <div
      inert={isAllDone}
      className={cn(
        "grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-300 ease-out",
        isAllDone &&
          "grid-rows-[0fr] opacity-0 delay-200 motion-reduce:[transition:opacity_150ms_ease-out_200ms,grid-template-rows_0s_350ms]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
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
      </div>
    </div>
  );
}, "DueBlock");
