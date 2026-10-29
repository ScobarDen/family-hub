import { reatomComponent } from "@reatom/react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/modules/ui";

import type { BrowserBack } from "../model/browser.model.ts";

export type BrowserBackButtonProps = { model: BrowserBack };

// Where the Mini App shows Telegram's Back in its header, the Installed App shows its own; it
// carries the top safe area, so the page right after it drops its own.
export const BrowserBackButton = reatomComponent(({ model }: BrowserBackButtonProps) => {
  if (!model.isVisible()) {
    return null;
  }

  return (
    <nav
      aria-label="Назад"
      data-back-bar
      className="sticky top-0 z-40 bg-secondary/90 px-2 pt-safe-top backdrop-blur"
    >
      <Button variant="ghost" onClick={model.press}>
        <ChevronLeft aria-hidden />
        Назад
      </Button>
    </nav>
  );
}, "BrowserBackButton");
