import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { Button, Notice, Skeleton } from "@/modules/ui";

import type { SessionModel, SessionScreen } from "../vm/session.vm.ts";
import { NotMember } from "./not-member.view.tsx";
import { Stranger } from "./stranger.view.tsx";
import { TelegramLogin } from "./telegram-login.view.tsx";

export type SessionProps = {
  model: SessionModel;
  familyRequest: ReactNode;
  joinFamily: ReactNode;
  home: ReactNode;
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

const screens: Record<SessionScreen["kind"], (props: SessionProps) => ReactNode> = {
  "family-request": ({ familyRequest }) => familyRequest,
  "join-family": ({ joinFamily }) => joinFamily,
  member: ({ home }) => home,
  stranger: ({ model }) => (
    <Stranger onInviteHelp={model.showInviteHelp} onRequestFamily={model.requestFamily} />
  ),
  "signed-out": ({ model }) => (
    <TelegramLogin botUsername={model.botUsername} onLogin={model.loginWith} />
  ),
  "not-member": ({ model }) => <NotMember botUrl={model.botUrl} onSignOut={model.signOutHere} />,
  failed: ({ model }) => (
    <Notice title="Не получилось войти" description="Проверьте соединение и попробуйте ещё раз.">
      <Button size="lg" onClick={model.signIn}>
        Повторить
      </Button>
    </Notice>
  ),
  "signing-in": () => <SigningIn />,
  restart: ({ model }) => (
    <Notice
      title="Перезапустите приложение"
      description={`Сессия устарела. Закройте ${model.appName} и откройте его снова.`}
    />
  ),
};

export const Session = reatomComponent(
  (props: SessionProps) => screens[props.model.screen().kind](props),
  "Session",
);
