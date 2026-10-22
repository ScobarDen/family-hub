import type { AppModule } from "@family-hub/contract";

import { moduleIcons } from "../tab-bar.config.ts";
import type { Tab } from "../vm/tab-bar.vm.ts";

type TabButtonProps = { tab: Tab; onOpen: (module: AppModule) => void };

export function TabButton({ tab, onOpen }: TabButtonProps) {
  const Icon = moduleIcons[tab.module];

  return (
    <button
      type="button"
      aria-current={tab.isActive ? "page" : undefined}
      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[0.6875rem] font-medium text-muted-foreground transition-colors aria-[current=page]:text-primary android:aria-[current=page]:bg-primary/15"
      onClick={() => {
        onOpen(tab.module);
      }}
    >
      <Icon className="size-6" />
      <span className="max-w-full truncate">{tab.title}</span>
    </button>
  );
}
