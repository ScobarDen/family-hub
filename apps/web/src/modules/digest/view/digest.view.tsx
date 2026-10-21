import { reatomComponent } from "@reatom/react";
import { Clock, Sunrise } from "lucide-react";

import { FieldError, Input, SectionItem, Switch } from "@/common/ui";

import type { DigestModel } from "../vm/digest.vm.ts";

export type DigestProps = { model: DigestModel };

const DigestTime = reatomComponent(
  ({ model }: DigestProps) => (
    <SectionItem
      icon={Clock}
      tone="gray"
      title="Время сводки"
      after={
        <Input
          className="w-28"
          type="time"
          aria-label="Время сводки"
          value={model.time()}
          onChange={(event) => {
            model.chooseTime(event.target.value);
          }}
        />
      }
    />
  ),
  "DigestTime",
);

export const DigestSetting = reatomComponent(({ model }: DigestProps) => {
  const failure = model.failure();

  return (
    <>
      <SectionItem
        icon={Sunrise}
        tone="orange"
        title="Утренняя сводка"
        subtitle="Что просрочено и что сегодня — сообщением от бота"
        after={
          <Switch
            aria-label="Утренняя сводка"
            checked={model.isEnabled()}
            onCheckedChange={(isChecked) => {
              model.toggle(isChecked);
            }}
          />
        }
      />
      {model.isEnabled() && <DigestTime model={model} />}
      {failure !== undefined && (
        <div className="px-4 py-2">
          <FieldError>{failure}</FieldError>
        </div>
      )}
    </>
  );
}, "DigestSetting");
