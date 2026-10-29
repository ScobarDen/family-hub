import { reatomComponent } from "@reatom/react";
import { BellOff } from "lucide-react";

import { Button } from "@/modules/ui";

import type { NotificationsModel } from "../vm/notifications.vm.ts";

export type NotificationsBannerProps = { model: NotificationsModel };

export const NotificationsBanner = reatomComponent(({ model }: NotificationsBannerProps) => {
  if (!model.isOff()) {
    return null;
  }

  return (
    <aside className="mx-4 mb-6 flex items-center gap-3 rounded-xl bg-card p-3 android:rounded-2xl">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-badge-orange text-white">
        <BellOff className="size-5" />
      </span>
      <div className="flex flex-1 flex-col">
        <span className="font-medium">Включите уведомления</span>
        <span className="text-sm text-muted-foreground">Иначе напоминания не дойдут</span>
      </div>
      <Button disabled={model.isEnabling()} onClick={model.enable}>
        Включить
      </Button>
    </aside>
  );
}, "NotificationsBanner");
