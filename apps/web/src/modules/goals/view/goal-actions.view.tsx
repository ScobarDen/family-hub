import { reatomComponent } from "@reatom/react";
import { Minus, Pencil } from "lucide-react";

import { Section, SectionItem } from "@/modules/ui";

import type { GoalsScreenModel } from "../vm/goals.vm.ts";

export const GoalActions = reatomComponent(
  ({ model }: { model: GoalsScreenModel }) => (
    <Section>
      <SectionItem
        icon={Minus}
        title="Снять с цели"
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
        title="Закрыть как исполненную"
        disabled={model.isChanging()}
        onClick={() => {
          model.complete("fulfilled");
        }}
      />
      <SectionItem
        title="Закрыть без исполнения"
        disabled={model.isChanging()}
        onClick={() => {
          model.complete("cancelled");
        }}
      />
    </Section>
  ),
  "GoalClosing",
);
