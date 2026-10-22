import { reatomComponent } from "@reatom/react";
import { Globe, Smartphone } from "lucide-react";

import { FieldError, SectionItem, Switch } from "@/common/ui";

import type { TimeZoneModel } from "../vm/time-zone.vm.ts";
import { TimeZoneSelect } from "./time-zone-select.view.tsx";

export type TimeZoneProps = { model: TimeZoneModel };

export const TimeZone = reatomComponent(({ model }: TimeZoneProps) => {
  const zone = model.zone();
  const failure = model.failure();

  return (
    <>
      <SectionItem
        icon={Smartphone}
        title="Как на устройстве"
        after={
          <Switch
            aria-label="Часовой пояс как на устройстве"
            checked={zone?.isAuto ?? true}
            onCheckedChange={(isChecked) => {
              model.followDevice(isChecked);
            }}
          />
        }
      />
      <SectionItem
        icon={Globe}
        title="Часовой пояс"
        after={
          <TimeZoneSelect
            value={zone?.timeZone ?? ""}
            zones={model.zones}
            onChoose={model.choose}
          />
        }
      />
      {failure !== undefined && (
        <div className="px-4 py-2">
          <FieldError>{failure}</FieldError>
        </div>
      )}
    </>
  );
}, "TimeZone");
