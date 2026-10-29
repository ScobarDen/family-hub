import { Send } from "lucide-react";

import { Button, Notice } from "@/modules/ui";

type NotMemberProps = { botUrl: string; onSignOut: () => void };

export function NotMember({ botUrl, onSignOut }: NotMemberProps) {
  return (
    <Notice
      title="Приложение — для участников семьи"
      description="Вступить в семью или создать свою можно в Telegram, у бота Family Hub."
    >
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button
          size="lg"
          nativeButton={false}
          render={<a href={botUrl} target="_blank" rel="noreferrer" />}
        >
          <Send data-icon="inline-start" />
          Открыть бота
        </Button>
        <Button size="lg" variant="secondary" onClick={onSignOut}>
          Войти другим аккаунтом
        </Button>
      </div>
    </Notice>
  );
}
