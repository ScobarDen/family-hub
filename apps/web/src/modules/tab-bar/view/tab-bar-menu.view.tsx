import { reatomComponent } from "@reatom/react";

import { FieldError, ScreenTitle, Section } from "@/common/ui";

import type { TabBarMenuModel } from "../vm/tab-bar-menu.vm.ts";
import { TabBarMenuItem } from "./tab-bar-menu-item.view.tsx";

export type TabBarMenuProps = { model: TabBarMenuModel };

export const TabBarMenu = reatomComponent(({ model }: TabBarMenuProps) => {
  const items = model.items();
  const shown = items.filter((item) => item.isEnabled);
  const hidden = items.filter((item) => !item.isEnabled);
  const handlers = { onToggle: model.toggle, onMoveUp: model.moveUp, onMoveDown: model.moveDown };

  return (
    <>
      <ScreenTitle title="Нижнее меню" subtitle="От 2 до 5 разделов, остальные — в Профиле" />
      <Section title="В меню" footer={<FieldError>{model.failure()}</FieldError>}>
        {shown.map((item) => (
          <TabBarMenuItem key={item.module} item={item} {...handlers} />
        ))}
      </Section>
      {hidden.length > 0 && (
        <Section title="Скрыты">
          {hidden.map((item) => (
            <TabBarMenuItem key={item.module} item={item} {...handlers} />
          ))}
        </Section>
      )}
    </>
  );
}, "TabBarMenu");
