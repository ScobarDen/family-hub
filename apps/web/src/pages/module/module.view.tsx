import { Settings } from "lucide-react";
import type { ReactNode } from "react";

import type { AppModule } from "@family-hub/contract";

import { Button, ScreenTitle, Section, SectionItem } from "@/common/ui";
import { moduleTitles } from "@/modules/tab-bar";

type ModulePageProps = {
  module: AppModule;
  title?: string;
  subtitle?: string | undefined;
  children?: ReactNode;
  banner: ReactNode;
  // Telegram before 7.0 has no «⋯ → Настройки», so the Profile needs a button of its own.
  onOpenProfile?: () => void;
};

export function ModulePage({
  module,
  title = moduleTitles[module],
  subtitle,
  children,
  banner,
  onOpenProfile,
}: ModulePageProps) {
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
      {children ?? (
        <Section>
          <SectionItem title={`Раздел «${title}» скоро появится`} />
        </Section>
      )}
    </>
  );
}
