import { reatomComponent } from "@reatom/react";
import { Download, Share, SquarePlus } from "lucide-react";

import { Button, Notice } from "@/modules/ui";

import type { InstallPageModel } from "../vm/install-page.vm.ts";

export type InstallPageProps = { model: InstallPageModel };

const unsupported = {
  title: "Этот браузер не устанавливает приложения",
  description:
    "Откройте страницу в Chrome или Edge на Android и компьютере, или в Safari на iPhone и iPad.",
};

function IosSteps() {
  return (
    <ol className="flex max-w-xs flex-col gap-3 text-left">
      <li className="flex items-center gap-3">
        <Share aria-hidden className="shrink-0 text-primary" />
        Нажмите «Поделиться» внизу Safari
      </li>
      <li className="flex items-center gap-3">
        <SquarePlus aria-hidden className="shrink-0 text-primary" />
        Выберите «На экран Домой» и нажмите «Добавить»
      </li>
    </ol>
  );
}

export const InstallPage = reatomComponent(({ model }: InstallPageProps) => {
  const screen = model.screen();

  if (screen.kind === "opening") {
    return <Notice title="Открываем Домового" />;
  }

  if (screen.kind === "installed") {
    return (
      <Notice title="Готово" description="Домовой появился среди приложений.">
        <Button size="lg" onClick={model.openApp}>
          Открыть
        </Button>
      </Notice>
    );
  }

  if (screen.kind === "prompt") {
    return (
      <Notice
        title="Домовой как приложение"
        description="Свой значок, своё окно и Push с напоминаниями — без Telegram."
      >
        <Button size="lg" onClick={model.install}>
          <Download data-icon="inline-start" />
          Установить
        </Button>
      </Notice>
    );
  }

  if (screen.kind === "ios-steps") {
    return (
      <Notice title="Добавьте Домового на экран «Домой»" description="Так это делается в Safari:">
        <IosSteps />
      </Notice>
    );
  }

  return <Notice {...unsupported} />;
}, "InstallPage");
