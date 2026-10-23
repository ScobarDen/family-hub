import { reatomComponent } from "@reatom/react";
import { Circle, CircleCheck, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { Button, CheckButton, FieldError, Section, SectionItem } from "@/common/ui";

import type { PlanDetails as PlanDetailsData, SubplanItem } from "../plans.lib.ts";
import type { PlansScreenModel } from "../vm/plans.vm.ts";
import { PlanAlbum } from "./plan-album.view.tsx";

type PlanDetailsProps = { plan: PlanDetailsData; model: PlansScreenModel };

const PlanHeader = reatomComponent(
  ({ plan, model }: PlanDetailsProps) => (
    <Section footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={plan.isPrivate ? Lock : undefined}
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
  const buttons = [
    { label: "Изменить шаг", icon: <Pencil />, onClick: model.editSubplan },
    { label: "Удалить шаг", icon: <Trash2 />, onClick: model.removeSubplan },
  ];

  return (
    <SectionItem
      control={
        <CheckButton
          label={`${subplan.isCompleted ? "Вернуть в работу" : "Отметить выполненным"}: ${subplan.title}`}
          isChecked={subplan.isCompleted}
          isAlert={subplan.isOverdue}
          disabled={model.isChanging()}
          onClick={() => {
            model.toggleSubplan(subplan.id);
          }}
        />
      }
      title={subplan.title}
      subtitle={subplan.subtitle}
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
      <Section title={plan.stepsTitle}>
        {plan.subplans.map((subplan) => (
          <SubplanRow key={subplan.id} subplan={subplan} model={model} />
        ))}
        <SectionItem icon={Plus} title="Добавить шаг" onClick={model.addSubplan} />
      </Section>
      {plan.album !== null && <PlanAlbum album={plan.album} onOpen={model.openAlbum} />}
      {plan.canDelete && (
        <Section>
          <SectionItem
            icon={Trash2}
            isDestructive
            title="Удалить план"
            onClick={model.removePlan}
          />
        </Section>
      )}
    </>
  );
}
