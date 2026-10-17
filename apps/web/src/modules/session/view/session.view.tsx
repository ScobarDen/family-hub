import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { Button, Notice } from "@/common/ui";

import type { SessionModel, SessionScreen } from "../vm/session.vm.ts";
import { Stranger } from "./stranger.view.tsx";

export type SessionProps = { model: SessionModel; familyRequest: ReactNode };

type PlainNotice = Extract<SessionScreen, { kind: "signing-in" | "outside-telegram" | "restart" }>;

const plainNotices: Record<PlainNotice["kind"], { title: string; description?: string }> = {
  "signing-in": { title: "Входим…" },
  "outside-telegram": {
    title: "Откройте Family Hub в Telegram",
    description: "Приложение работает только внутри Telegram.",
  },
  restart: {
    title: "Перезапустите приложение",
    description: "Сессия устарела. Закройте Family Hub и откройте его снова.",
  },
};

export const Session = reatomComponent(({ model, familyRequest }: SessionProps) => {
  const screen = model.screen();

  if (screen.kind === "family-request") {
    return familyRequest;
  }

  if (screen.kind === "stranger") {
    return <Stranger onInviteHelp={model.showInviteHelp} onRequestFamily={model.requestFamily} />;
  }

  if (screen.kind === "member") {
    return <Notice title={`Привет, ${screen.memberName}`} description={screen.familyName} />;
  }

  if (screen.kind === "failed") {
    return (
      <Notice title="Не получилось войти" description="Проверьте соединение и попробуйте ещё раз.">
        <Button size="lg" onClick={model.signIn}>
          Повторить
        </Button>
      </Notice>
    );
  }

  return <Notice {...plainNotices[screen.kind]} />;
}, "Session");
