import { reatomComponent } from "@reatom/react";
import { ChevronRight } from "lucide-react";

import { sectionIcons } from "@/common/sections";
import { Button, Section, SectionItem } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";

// The card goes away when nothing is due; the header already says the day is free.
export const DueBlock = reatomComponent(({ model }: { model: TodayModel }) => {
  const rows = model.rows();
  const more = model.more();

  if (rows.length === 0) {
    return null;
  }

  return (
    <Section title="Сделать сегодня">
      {rows.map((row) => (
        <SectionItem
          key={row.key}
          icon={sectionIcons[row.module]}
          isAlert={row.isOverdue}
          title={row.title}
          subtitle={row.isOverdue ? `Просрочено · ${row.when}` : row.when}
          after={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                model.act(row.key);
              }}
            >
              {row.action.title}
            </Button>
          }
        />
      ))}
      {more !== undefined && (
        <SectionItem title={`Ещё ${more}`} after={<ChevronRight />} onClick={model.openFeed} />
      )}
    </Section>
  );
}, "DueBlock");
