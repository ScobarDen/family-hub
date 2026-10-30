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

// The bot backs Push up under «both», and stands in under «push» only when no Device took it.
const hints: Record<ReminderChannel, string> = {
  both: "Надёжнее всего: Push на устройства, где он включён, и сообщение от бота",
  telegram: "Только сообщение от бота",
  push: "Для тех, кто без Telegram под рукой. Если ни одно устройство не примет Push, напомнит бот",
};

export function reatomReminderChannel({ api, saved, haptics }: ReminderChannelDependencies) {
  const setting = reatomSavedSetting("reminderChannel", { send: api.saveReminderChannel, saved });

  const current = computed(
    (): ReminderChannel => setting.current() ?? defaultReminderChannel,
    "reminderChannel.current",
  );

  return {
    channel: current,
    hint: computed(() => hints[current()], "reminderChannel.hint"),
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
