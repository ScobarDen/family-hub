import { reatomComponent } from "@reatom/react";
import { Pencil, Trash2 } from "lucide-react";

import { Button, SectionItem } from "@/modules/ui";

import type { MovementItem } from "../goals.lib.ts";
import type { GoalsScreenModel } from "../vm/goals.vm.ts";

type MovementRowProps = { movement: MovementItem; model: GoalsScreenModel; isReadOnly: boolean };

// Only the Member who recorded a movement changes or deletes it, and never on a Completed Goal.
export const MovementRow = reatomComponent(({ movement, model, isReadOnly }: MovementRowProps) => {
  const buttons = [
    { label: "Изменить", icon: <Pencil />, onClick: model.editMovement },
    { label: "Удалить", icon: <Trash2 />, onClick: model.removeMovement },
  ];

  return (
    <SectionItem
      title={movement.title}
      subtitle={movement.subtitle}
      after={
        movement.isOwn &&
        !isReadOnly &&
        buttons.map(({ label, icon, onClick }) => (
          <Button
            key={label}
            size="icon-sm"
            variant="ghost"
            aria-label={`${label} ${movement.name}`}
            onClick={() => {
              onClick(movement.id);
            }}
          >
            {icon}
          </Button>
        ))
      }
    />
  );
}, "MovementRow");
