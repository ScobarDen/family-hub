import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import type { TabBarModel } from "../vm/tab-bar.vm.ts";
import { TabButton } from "./tab-button.view.tsx";

export type TabBarProps = {
  model: TabBarModel;
  // The microphone is pressed and held, so the bar wraps it in no pointer handlers of its own.
  center?: ReactNode;
};

export const TabBar = reatomComponent(({ model, center }: TabBarProps) => {
  const { start, end } = model.tabs();

  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-40 android:px-4 android:pb-[calc(var(--safe-area-bottom)+0.75rem)] ios:border-t ios:bg-background/75 ios:pb-safe-bottom ios:backdrop-blur-xl ios:backdrop-saturate-150"
    >
      <div className="mx-auto flex max-w-lg items-center android:rounded-full android:bg-card android:p-1 android:shadow-lg android:ring-1 android:ring-border ios:px-2 ios:pt-1">
        {start.map((tab) => (
          <TabButton key={tab.id} tab={tab} onOpen={model.open} />
        ))}
        {center !== undefined && <div className="flex shrink-0 justify-center px-1">{center}</div>}
        {end.map((tab) => (
          <TabButton key={tab.id} tab={tab} onOpen={model.open} />
        ))}
      </div>
    </nav>
  );
}, "TabBar");
