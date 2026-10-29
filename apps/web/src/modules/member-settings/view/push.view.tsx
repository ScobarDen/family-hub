import { reatomComponent } from "@reatom/react";
import { BellRing } from "lucide-react";

import { FieldError, SectionItem, Switch } from "@/modules/ui";

import type { PushModel } from "../vm/push.vm.ts";

// No Push model where the bot reaches the Member instead: inside Telegram.
export type PushSettingProps = { model: PushModel | undefined };

export const PushSetting = reatomComponent(({ model }: PushSettingProps) => {
  if (model === undefined) {
    return null;
  }

  const state = model.state();

  if (state === "unsupported") {
    return null;
  }

  return (
    <>
      <SectionItem
        icon={BellRing}
        isAlert={state === "denied"}
        title="Push на этом устройстве"
        subtitle={model.hint()}
        after={
          model.canToggle() && (
            <Switch
              aria-label="Push на этом устройстве"
              checked={model.isOn()}
              disabled={model.isSwitching()}
              onCheckedChange={(isChecked) => {
                model.toggle(isChecked);
              }}
            />
          )
        }
      />
      <FieldError className="px-4 py-2">{model.failure()}</FieldError>
    </>
  );
}, "PushSetting");
