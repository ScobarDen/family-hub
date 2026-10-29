import { useEffect, useRef } from "react";

export type LoginWidgetProps = {
  botUsername: string;
  onLogin: (login: unknown) => void;
};

const widgetUrl = "https://telegram.org/js/telegram-widget.js?22";
const callbackName = "onFamilyHubTelegramLogin";

// Telegram's widget draws its own button in an iframe and calls a global with the signed login.
export function LoginWidget({ botUsername, onLogin }: LoginWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = container.current;
    const script = document.createElement("script");

    Object.assign(window, { [callbackName]: onLogin });
    script.async = true;
    script.src = widgetUrl;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.radius = "12";
    script.dataset.onauth = `${callbackName}(user)`;
    script.dataset.requestAccess = "write";
    host?.append(script);

    return () => {
      host?.replaceChildren();
      Reflect.deleteProperty(window, callbackName);
    };
  }, [botUsername, onLogin]);

  return <div ref={container} className="flex min-h-12 justify-center" />;
}
