import { reatomComponent } from "@reatom/react";

import { Section, SectionItem } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";

export const NextBlock = reatomComponent(({ model }: { model: TodayModel }) => {
  const rows = model.next();

  return (
    <Section
      title="Дальше"
      aside={
        <button type="button" className="text-link" onClick={model.openFeed}>
          Вся лента
        </button>
      }
    >
      {rows.length === 0 ? (
        <SectionItem title="Ничего не запланировано" />
      ) : (
        rows.map(({ key, title, when }) => (
          <SectionItem
            key={key}
            title={title}
            subtitle={when}
            onClick={() => {
              model.openItem(key);
            }}
          />
        ))
      )}
    </Section>
  );
}, "NextBlock");
