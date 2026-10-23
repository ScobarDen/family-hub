import { reatomComponent } from "@reatom/react";

import { PrimaryButton, Section, SectionItem, SectionLayout } from "@/common/ui";

import { goalIcons } from "../goals.config.ts";
import type { GoalListItem } from "../goals.lib.ts";
import type { GoalsScreen, GoalsScreenModel } from "../vm/goals.vm.ts";

type ListScreen = Extract<GoalsScreen, { kind: "list" }>;

type GoalListProps = { model: GoalsScreenModel; screen: ListScreen };

function rowsOf(goals: GoalListItem[], model: GoalsScreenModel) {
  return (
    <Section>
      {goals.length === 0 && <SectionItem title="Пока пусто" />}
      {goals.map((goal) => (
        <SectionItem
          key={goal.id}
          icon={goalIcons[goal.icon]}
          tone={goal.color}
          iconVariant="badge"
          title={goal.title}
          subtitle={goal.progress}
          onClick={() => {
            model.open(goal.id);
          }}
        />
      ))}
    </Section>
  );
}

export const GoalList = reatomComponent(
  ({ model, screen }: GoalListProps) => (
    <SectionLayout
      summary={
        <div className="flex flex-col gap-0.5 px-5 pb-4">
          <span className="text-[1.75rem] leading-none font-semibold tracking-tight">
            {screen.total}
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">
            Накоплено в общих целях и ваших личных, без закрытых
          </span>
        </div>
      }
      action={<PrimaryButton onClick={model.add}>Новая цель</PrimaryButton>}
      tabs={[
        { key: "active", title: "Копим", content: rowsOf(screen.active, model) },
        { key: "achieved", title: "Достигнуты", content: rowsOf(screen.achieved, model) },
        { key: "archive", title: "Архив", content: rowsOf(screen.archive, model) },
      ]}
    />
  ),
  "GoalList",
);
