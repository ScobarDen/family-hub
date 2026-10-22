import { reatomComponent } from "@reatom/react";
import { Minus, Pencil, Plus } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { GoalsScreenModel } from "../vm/goals.vm.ts";

export const GoalActions = reatomComponent(
  ({ model }: { model: GoalsScreenModel }) => (
    <Section>
      <SectionItem
        icon={Plus}
        title="Пополнить"
        onClick={() => {
          model.addMovement("contribution");
        }}
      />
      <SectionItem
        icon={Minus}
        title="Снять"
        onClick={() => {
          model.addMovement("withdrawal");
        }}
      />
      <SectionItem icon={Pencil} title="Изменить цель" onClick={model.edit} />
    </Section>
  ),
  "GoalActions",
);

export const GoalClosing = reatomComponent(
  ({ model }: { model: GoalsScreenModel }) => (
    <Section title="Закрыть цель">
      <SectionItem
        title="Цель исполнена"
        disabled={model.isChanging()}
        onClick={() => {
          model.complete("fulfilled");
        }}
      />
      <SectionItem
        title="Отменить цель"
        disabled={model.isChanging()}
        onClick={() => {
          model.complete("cancelled");
        }}
      />
    </Section>
  ),
  "GoalClosing",
);
