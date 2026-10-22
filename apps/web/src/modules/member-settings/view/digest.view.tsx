import { reatomComponent } from "@reatom/react";
import { Clock, Sunrise } from "lucide-react";

import { FieldError, Input, SectionItem, Switch } from "@/common/ui";

import type { DigestModel } from "../vm/digest.vm.ts";

export type DigestProps = { model: DigestModel };

const DigestTime = reatomComponent(
  ({ model }: DigestProps) => (
    <SectionItem
      icon={Clock}
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

// What the bot will send, so the switch shows its result rather than a promise.
const DigestPreview = reatomComponent(
  ({ model }: DigestProps) => (
    <div className="border-t border-border px-4 pt-3 pb-4 pl-14">
      <div className="flex max-w-72 flex-col gap-1 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-[0.9375rem]">
        <span className="font-medium">Сводка на сегодня</span>
        <span>Просрочено: что не успели раньше</span>
        <span>Сегодня: события, напоминания и сроки</span>
        <span className="self-end text-xs text-muted-foreground">{model.time()}</span>
      </div>
      <p className="pt-2 text-[0.8125rem] text-muted-foreground">
        В день, когда нечего сказать, бот промолчит
      </p>
    </div>
  ),
  "DigestPreview",
);

export const DigestSetting = reatomComponent(({ model }: DigestProps) => {
  const failure = model.failure();

  return (
    <>
      <SectionItem
        icon={Sunrise}
        title="Утренняя сводка"
        subtitle={model.schedule()}
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
      {model.isEnabled() && (
        <>
          <DigestTime model={model} />
          <DigestPreview model={model} />
        </>
      )}
      <FieldError className="px-4 py-2">{failure}</FieldError>
    </>
  );
}, "DigestSetting");
