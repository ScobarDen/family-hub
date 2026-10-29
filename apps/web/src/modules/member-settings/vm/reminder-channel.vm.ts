import { action, computed, noop } from "@reatom/core";

import { defaultReminderChannel, type ReminderChannel } from "@family-hub/contract";

import { reatomFailure } from "@/modules/changes";
import type { Haptics } from "@/modules/telegram";

import type { MemberSettingsApi } from "../member-settings.api.ts";
import { reatomSavedSetting } from "../member-settings.model.ts";

type ReminderChannelDependencies = {
  api: Pick<MemberSettingsApi, "saveReminderChannel">;
  // undefined until the Member's settings arrive.
  saved: () => ReminderChannel | undefined;
  haptics: Pick<Haptics, "select" | "error">;
};

export const reminderChannelChoices: Array<{ value: ReminderChannel; label: string }> = [
  { value: "both", label: "В Telegram и Push" },
  { value: "telegram", label: "Только в Telegram" },
  { value: "push", label: "Только Push" },
];

export function reatomReminderChannel({ api, saved, haptics }: ReminderChannelDependencies) {
  const setting = reatomSavedSetting("reminderChannel", { send: api.saveReminderChannel, saved });

  return {
    channel: computed(
      (): ReminderChannel => setting.current() ?? defaultReminderChannel,
      "reminderChannel.current",
    ),
    choices: reminderChannelChoices,
    failure: reatomFailure(setting.save, {
      message: "Не получилось сохранить, куда слать напоминания. Попробуйте ещё раз.",
      name: "reminderChannel.failure",
      haptics,
    }),

    choose: action((channel: ReminderChannel) => {
      haptics.select();
      setting.save(channel).catch(noop);
    }, "reminderChannel.choose"),
  };
}

export type ReminderChannelModel = ReturnType<typeof reatomReminderChannel>;
