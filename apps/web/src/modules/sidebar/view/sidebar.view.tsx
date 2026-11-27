import { reatomComponent } from "@reatom/react";
import { Plus } from "lucide-react";

import type { SidebarModel } from "../sidebar.vm.ts";
import { SidebarItem } from "./sidebar-item.view.tsx";

export const Sidebar = reatomComponent(
  ({ model }: { model: SidebarModel }) => (
    <nav
      aria-label="Разделы"
      className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-4 px-3 pt-[calc(var(--safe-area-top)+1rem)] pb-[calc(var(--safe-area-bottom)+1rem)] android:border-r android:border-border android:bg-card ios:border-r ios:border-border ios:bg-card/70 ios:backdrop-blur-xl ios:backdrop-saturate-150"
    >
      <button
        type="button"
        aria-haspopup="dialog"
        className="press flex items-center gap-2 bg-primary px-4 py-2.5 text-subhead font-medium text-primary-foreground shadow-md select-none android:rounded-full ios:rounded-xl"
        onClick={model.add}
      >
        <Plus className="size-5" aria-hidden />
        Добавить
      </button>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {model.items().map((item) => (
          <li key={item.id}>
            <SidebarItem item={item} onOpen={model.open} />
          </li>
        ))}
      </ul>
      <SidebarItem item={model.profile()} onOpen={model.open} />
    </nav>
  ),
  "Sidebar",
);
