import { Notice } from "@/modules/ui";

import { LoginWidget, type LoginWidgetProps } from "./login-widget.view.tsx";

export function TelegramLogin(props: LoginWidgetProps) {
  return (
    <Notice
      title="Войдите через Telegram"
      description="Тот же аккаунт, та же семья и те же данные, что в Telegram."
    >
      <LoginWidget {...props} />
    </Notice>
  );
}
