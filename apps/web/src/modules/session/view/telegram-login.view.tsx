import { TelegramLoginWidget } from "@/modules/telegram";
import { Notice } from "@/modules/ui";

type TelegramLoginProps = { botUsername: string; onLogin: (login: unknown) => void };

export function TelegramLogin(props: TelegramLoginProps) {
  return (
    <Notice
      title="Войдите через Telegram"
      description="Тот же аккаунт, та же семья и те же данные, что в Telegram."
    >
      <TelegramLoginWidget {...props} />
    </Notice>
  );
}
