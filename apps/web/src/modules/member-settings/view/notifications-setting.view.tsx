import { reatomComponent } from "@reatom/react";
import { Bell } from "lucide-react";

import { Button, SectionItem } from "@/modules/ui";

import type { NotificationsModel } from "../vm/notifications.vm.ts";

export type NotificationsSettingProps = { model: NotificationsModel };

export const NotificationsSetting = reatomComponent(({ model }: NotificationsSettingProps) => {
  const isOff = model.isOff();

  return (
    <SectionItem
      icon={Bell}
      isAlert={isOff}
      title="Уведомления от бота"
      subtitle={isOff ? "Выключены — напоминания не дойдут" : "Включены"}
      after={
        isOff && (
          <Button size="sm" disabled={model.isEnabling()} onClick={model.enable}>
            Включить
          </Button>
        )
      }
    />
  );
}, "NotificationsSetting");
