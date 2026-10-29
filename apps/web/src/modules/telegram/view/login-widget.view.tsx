import { noop } from "@reatom/core";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/modules/ui";

export type TelegramLoginWidgetProps = {
  botUsername: string;
  onLogin: (login: unknown) => void;
};

const widgetUrl = "https://telegram.org/js/telegram-widget.js?22";
const callbackName = "onFamilyHubTelegramLogin";

// Telegram's widget draws its own button in an iframe and calls a global with the signed login.
function appendWidget(
  host: HTMLElement,
  { botUsername, onLogin, onFailure }: TelegramLoginWidgetProps & { onFailure: () => void },
): () => void {
  const script = document.createElement("script");

  Object.assign(window, { [callbackName]: onLogin });
  script.async = true;
  script.src = widgetUrl;
  script.dataset.telegramLogin = botUsername;
  script.dataset.size = "large";
  script.dataset.radius = "12";
  script.dataset.onauth = `${callbackName}(user)`;
  script.dataset.requestAccess = "write";
  script.addEventListener("error", onFailure);
  host.append(script);

  return () => {
    host.replaceChildren();
    Reflect.deleteProperty(window, callbackName);
  };
}

export function TelegramLoginWidget({ botUsername, onLogin }: TelegramLoginWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const host = container.current;

    if (hasFailed || host === null) {
      return noop;
    }

    return appendWidget(host, {
      botUsername,
      onLogin,
      onFailure: () => {
        setHasFailed(true);
      },
    });
  }, [botUsername, onLogin, hasFailed]);

  if (hasFailed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Не загрузилась кнопка входа. Проверьте интернет и повторите.
        </p>
        <Button size="lg" onClick={() => setHasFailed(false)}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={container}
      role="group"
      aria-label="Вход через Telegram"
      className="flex min-h-12 justify-center"
    />
  );
}
