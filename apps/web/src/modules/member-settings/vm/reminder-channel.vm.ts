import { action, atom, computed, noop } from "@reatom/core";

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

// Telegram backs Push up under «both», and stands in under «push» only when no Device took it.
const hints: Record<ReminderChannel, string> = {
  both: "Надёжнее всего: Push на устройства, где он включён, и сообщение в Telegram",
  telegram: "Только сообщение в Telegram",
  push: "Если ни одно устройство не примет Push, напоминание всё равно придёт в Telegram",
};

export function reatomReminderChannel({ api, saved, haptics }: ReminderChannelDependencies) {
  const setting = reatomSavedSetting("reminderChannel", { send: api.saveReminderChannel, saved });

  const hasChosen = atom(false, "reminderChannel.hasChosen");
  const current = computed(
    (): ReminderChannel => setting.current() ?? defaultReminderChannel,
    "reminderChannel.current",
  );

  return {
    channel: current,
    hint: computed(() => hints[current()], "reminderChannel.hint"),
    // Read out once the Member picks a channel, as the hint under the chips changes with it.
    announcement: computed(
      () => (hasChosen() ? hints[current()] : ""),
      "reminderChannel.announcement",
    ),
    choices: reminderChannelChoices,
    failure: reatomFailure(setting.save, {
      message: "Не получилось сохранить, куда слать напоминания. Попробуйте ещё раз.",
      name: "reminderChannel.failure",
      haptics,
    }),

    choose: action((channel: ReminderChannel) => {
      haptics.select();
      hasChosen.set(true);
      setting.save(channel).catch(noop);
    }, "reminderChannel.choose"),
  };
}

export type ReminderChannelModel = ReturnType<typeof reatomReminderChannel>;
