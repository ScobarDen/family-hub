import type { ReactNode } from "react";

import { ScreenTitle } from "@/modules/ui";

type ModulePageProps = {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  banner: ReactNode;
};

export function ModulePage({ title, subtitle, children, banner }: ModulePageProps) {
  return (
    <>
      <ScreenTitle title={title} {...(subtitle === undefined ? {} : { subtitle })} />
      {banner}
      {children}
    </>
  );
}
