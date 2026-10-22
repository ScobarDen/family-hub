import { Settings } from "lucide-react";
import type { ReactNode } from "react";

import { Button, ScreenTitle } from "@/common/ui";

type ModulePageProps = {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  banner: ReactNode;
  // Telegram before 7.0 has no «⋯ → Настройки», so the Profile needs a button of its own.
  onOpenProfile?: () => void;
};

export function ModulePage({ title, subtitle, children, banner, onOpenProfile }: ModulePageProps) {
  return (
    <>
      <div className="flex items-start justify-between">
        <ScreenTitle title={title} {...(subtitle === undefined ? {} : { subtitle })} />
        {onOpenProfile !== undefined && (
          <Button
            className="mt-5 mr-3"
            size="icon-lg"
            variant="ghost"
            aria-label="Профиль"
            onClick={onOpenProfile}
          >
            <Settings />
          </Button>
        )}
      </div>
      {banner}
      {children}
    </>
  );
}
