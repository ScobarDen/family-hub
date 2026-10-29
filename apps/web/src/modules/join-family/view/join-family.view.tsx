import { reatomComponent } from "@reatom/react";

import { Button, Notice } from "@/modules/ui";

import type { JoinFamilyModel, JoinFamilyScreen } from "../vm/join-family.vm.ts";
import { InviteCard } from "./invite-card.view.tsx";
import { InviteOpening } from "./invite-opening.view.tsx";

export type JoinFamilyProps = { model: JoinFamilyModel };

type Dead = Extract<JoinFamilyScreen, { kind: "unavailable" | "in-other-family" }>;

const deadEnds: Record<Dead["kind"], { title: string; description: string }> = {
  unavailable: {
    title: "Приглашение не действует",
    description: "Его уже использовали, отозвали или прошло 7 дней. Попросите прислать новое.",
  },
  "in-other-family": {
    title: "Сначала выйдите из своей семьи",
    description:
      "Состоять можно только в одной семье. Выйдите из нынешней и откройте ссылку снова.",
  },
};

export const JoinFamily = reatomComponent(({ model }: JoinFamilyProps) => {
  const screen = model.screen();

  if (screen.kind === "invite") {
    return (
      <InviteCard model={model} inviterName={screen.inviterName} familyName={screen.familyName} />
    );
  }

  if (screen.kind === "failed") {
    return (
      <Notice
        title="Не получилось открыть приглашение"
        description="Проверьте соединение и попробуйте ещё раз."
      >
        <Button size="lg" onClick={model.load}>
          Повторить
        </Button>
      </Notice>
    );
  }

  if (screen.kind === "unavailable" || screen.kind === "in-other-family") {
    return (
      <Notice {...deadEnds[screen.kind]}>
        <Button size="lg" variant="secondary" onClick={model.close}>
          Продолжить
        </Button>
      </Notice>
    );
  }

  return <InviteOpening />;
}, "JoinFamily");
