import { Plus } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import { goalIcons } from "../goals.config.ts";
import type { GoalListItem } from "../goals.lib.ts";
import type { GoalsScreen, GoalsScreenModel } from "../vm/goals.vm.ts";

type ListScreen = Extract<GoalsScreen, { kind: "list" }>;

function GoalRows({ goals, model }: { goals: GoalListItem[]; model: GoalsScreenModel }) {
  return goals.map((goal) => (
    <SectionItem
      key={goal.id}
      icon={goalIcons[goal.icon]}
      tone={goal.color}
      iconVariant="badge"
      title={goal.title}
      subtitle={`${goal.subtitle} · ${goal.percent}%`}
      onClick={() => {
        model.open(goal.id);
      }}
    />
  ));
}

export function GoalList({ model, screen }: { model: GoalsScreenModel; screen: ListScreen }) {
  return (
    <>
      <Section title="Всего накоплено">
        <SectionItem title={screen.total} subtitle="Общие цели и ваши личные, без закрытых" />
      </Section>
      <Section title="Копим">
        <GoalRows goals={screen.active} model={model} />
        <SectionItem icon={Plus} tone="teal" title="Новая цель" onClick={model.add} />
      </Section>
      {screen.achieved.length > 0 && (
        <Section title="Достигнуты">
          <GoalRows goals={screen.achieved} model={model} />
        </Section>
      )}
      {screen.archive.length > 0 && (
        <Section title="Архив">
          <GoalRows goals={screen.archive} model={model} />
        </Section>
      )}
    </>
  );
}
