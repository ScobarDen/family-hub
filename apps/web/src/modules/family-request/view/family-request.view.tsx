import { reatomComponent } from "@reatom/react";

import { Button, Notice } from "@/common/ui";

import type { FamilyRequestModel, FamilyRequestScreen } from "../vm/family-request.vm.ts";
import { FamilyRequestForm } from "./family-request-form.view.tsx";

export type FamilyRequestProps = { model: FamilyRequestModel };

type Waiting = Exclude<FamilyRequestScreen["kind"], "form" | "cooldown">;

const waitingNotices: Record<Waiting, { title: string; description: string }> = {
  sent: {
    title: "Заявка отправлена",
    description: "Как только её одобрят, бот пришлёт сообщение, а здесь откроется ваша семья.",
  },
  "already-pending": {
    title: "Заявка уже на рассмотрении",
    description: "Бот пришлёт сообщение, как только Operator её рассмотрит.",
  },
};

export const FamilyRequest = reatomComponent(({ model }: FamilyRequestProps) => {
  const screen = model.screen();

  if (screen.kind === "form") {
    return <FamilyRequestForm model={model} />;
  }

  if (screen.kind === "cooldown") {
    return (
      <Notice
        title="Пока нельзя отправить заявку"
        description="После отказа новую заявку можно отправить через 7 дней."
      >
        <Button size="lg" variant="secondary" onClick={model.back}>
          Назад
        </Button>
      </Notice>
    );
  }

  return (
    <Notice {...waitingNotices[screen.kind]}>
      <Button size="lg" onClick={model.check}>
        Проверить
      </Button>
    </Notice>
  );
}, "FamilyRequest");
