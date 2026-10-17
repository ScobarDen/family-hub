import { reatomComponent } from "@reatom/react";

import { Button, FieldError, Notice } from "@/common/ui";

import type { JoinFamilyModel } from "../vm/join-family.vm.ts";

type InviteCardProps = { model: JoinFamilyModel; inviterName: string; familyName: string };

export const InviteCard = reatomComponent(({ model, inviterName, familyName }: InviteCardProps) => {
  const isJoining = model.isJoining();

  return (
    <Notice
      title={`${inviterName} зовёт вас в семью «${familyName}»`}
      description="В Family Hub семья ведёт общие планы, напоминания, рецепты и заботу о питомцах."
    >
      <div className="flex w-full max-w-xs flex-col gap-3">
        <FieldError>{model.failure()}</FieldError>
        <Button size="lg" disabled={isJoining} onClick={model.join}>
          {isJoining ? "Вступаем…" : "Вступить"}
        </Button>
      </div>
    </Notice>
  );
}, "InviteCard");
