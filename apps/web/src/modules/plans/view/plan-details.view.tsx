import { reatomComponent } from "@reatom/react";
import { Circle, CircleCheck, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { Button, FieldError, Section, SectionItem } from "@/common/ui";

import type { PlanDetails as PlanDetailsData, SubplanItem } from "../plans.lib.ts";
import type { PlansScreenModel } from "../vm/plans.vm.ts";

type PlanDetailsProps = { plan: PlanDetailsData; model: PlansScreenModel };

const PlanHeader = reatomComponent(
  ({ plan, model }: PlanDetailsProps) => (
    <Section footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={plan.isPrivate ? Lock : undefined}
        tone="gray"
        title={plan.facts ?? "Без срока и исполнителя"}
        subtitle={plan.note}
        after={
          <Button size="icon-sm" variant="ghost" aria-label="Изменить" onClick={model.edit}>
            <Pencil />
          </Button>
        }
      />
      <SectionItem
        icon={plan.isCompleted ? CircleCheck : Circle}
        tone={plan.isCompleted ? "green" : "gray"}
        title={plan.isCompleted ? "Вернуть в работу" : "Отметить выполненным"}
        subtitle={plan.completed}
        disabled={model.isChanging()}
        onClick={model.togglePlan}
      />
    </Section>
  ),
  "PlanHeader",
);

type SubplanRowProps = { subplan: SubplanItem; model: PlansScreenModel };

const SubplanRow = reatomComponent(({ subplan, model }: SubplanRowProps) => {
  const lateness = subplan.isLaterThanPlan ? "позже срока плана" : undefined;
  const buttons = [
    {
      label: subplan.isCompleted ? "Вернуть в работу" : "Выполнено",
      icon: subplan.isCompleted ? <CircleCheck className="text-green-500" /> : <Circle />,
      onClick: model.toggleSubplan,
    },
    { label: "Изменить шаг", icon: <Pencil />, onClick: model.editSubplan },
    { label: "Удалить шаг", icon: <Trash2 />, onClick: model.removeSubplan },
  ];

  return (
    <SectionItem
      title={subplan.title}
      subtitle={[subplan.subtitle, lateness].filter(Boolean).join(" · ") || undefined}
      after={buttons.map(({ label, icon, onClick }) => (
        <Button
          key={label}
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          disabled={model.isChanging()}
          onClick={() => {
            onClick(subplan.id);
          }}
        >
          {icon}
        </Button>
      ))}
    />
  );
}, "SubplanRow");

export function PlanDetails({ plan, model }: PlanDetailsProps) {
  return (
    <>
      <PlanHeader plan={plan} model={model} />
      <Section title={plan.progress === undefined ? "Шаги" : `Шаги · ${plan.progress}`}>
        {plan.subplans.map((subplan) => (
          <SubplanRow key={subplan.id} subplan={subplan} model={model} />
        ))}
        <SectionItem icon={Plus} tone="green" title="Добавить шаг" onClick={model.addSubplan} />
      </Section>
      {plan.canDelete && (
        <Section>
          <SectionItem icon={Trash2} tone="red" title="Удалить план" onClick={model.removePlan} />
        </Section>
      )}
    </>
  );
}
