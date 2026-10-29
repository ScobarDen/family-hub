import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { Button, Notice, Skeleton } from "@/modules/ui";

import type { SessionModel, SessionScreen } from "../vm/session.vm.ts";
import { Stranger } from "./stranger.view.tsx";

export type SessionProps = {
  model: SessionModel;
  familyRequest: ReactNode;
  joinFamily: ReactNode;
  home: ReactNode;
};

type PlainNotice = Extract<SessionScreen, { kind: "outside-telegram" | "restart" }>;

const plainNotices: Record<PlainNotice["kind"], { title: string; description?: string }> = {
  "outside-telegram": {
    title: "Откройте Family Hub в Telegram",
    description: "Приложение работает только внутри Telegram.",
  },
  restart: {
    title: "Перезапустите приложение",
    description: "Сессия устарела. Закройте Family Hub и откройте его снова.",
  },
};

// Only a first launch, or one without DeviceStorage, waits here: otherwise the cached shell shows.
function SigningIn() {
  return (
    <main
      aria-busy
      className="flex min-h-svh flex-col gap-4 bg-secondary px-4 pt-safe-top pb-safe-bottom"
    >
      <h1 className="sr-only">Входим</h1>
      <Skeleton className="mt-6 h-8 w-40" />
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    </main>
  );
}

export const Session = reatomComponent(
  ({ model, familyRequest, joinFamily, home }: SessionProps) => {
    const screen = model.screen();

    if (screen.kind === "family-request") {
      return familyRequest;
    }

    if (screen.kind === "join-family") {
      return joinFamily;
    }

    if (screen.kind === "stranger") {
      return <Stranger onInviteHelp={model.showInviteHelp} onRequestFamily={model.requestFamily} />;
    }

    if (screen.kind === "member") {
      return home;
    }

    if (screen.kind === "failed") {
      return (
        <Notice
          title="Не получилось войти"
          description="Проверьте соединение и попробуйте ещё раз."
        >
          <Button size="lg" onClick={model.signIn}>
            Повторить
          </Button>
        </Notice>
      );
    }

    if (screen.kind === "signing-in") {
      return <SigningIn />;
    }

    return <Notice {...plainNotices[screen.kind]} />;
  },
  "Session",
);
