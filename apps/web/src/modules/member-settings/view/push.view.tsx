import { reatomComponent } from "@reatom/react";
import { BellRing } from "lucide-react";

import { FieldError, SectionItem, Switch } from "@/modules/ui";

import type { PushModel } from "../vm/push.vm.ts";

export type PushSettingProps = { model: PushModel };

export const PushSetting = reatomComponent(({ model }: PushSettingProps) => {
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
          (state === "on" || state === "off" || state === "denied") && (
            <Switch
              aria-label="Push на этом устройстве"
              checked={state === "on"}
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
