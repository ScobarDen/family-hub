import { Mail, Plus } from "lucide-react";

import { Button } from "@/common/ui";

import { Notice } from "./notice.view.tsx";

type StrangerProps = {
  onInviteHelp: () => void;
  onRequestFamily: () => void;
};

export function Stranger({ onInviteHelp, onRequestFamily }: StrangerProps) {
  return (
    <Notice
      title="Family Hub работает по приглашениям"
      description="Войти может только тот, кого пригласили в семью, или тот, кто создаст свою."
    >
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" onClick={onInviteHelp}>
          <Mail data-icon="inline-start" />У меня есть приглашение
        </Button>
        <Button size="lg" variant="secondary" onClick={onRequestFamily}>
          <Plus data-icon="inline-start" />
          Создать свою семью
        </Button>
      </div>
    </Notice>
  );
}
