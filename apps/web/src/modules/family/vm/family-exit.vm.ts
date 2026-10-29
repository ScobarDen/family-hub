import { action, reatomForm, withAsync, wrap } from "@reatom/core";
import { z } from "zod";

import { matchingName } from "@/modules/form";
import { isConfirmed } from "@/modules/telegram";

import type { FamilySources } from "./family-sources.vm.ts";

async function leaveAfterConfirmation({ api, telegram, self, onLeft, failure }: FamilySources) {
  const isSure = await wrap(
    isConfirmed(telegram, {
      title: `Покинуть семью «${self()?.familyName ?? ""}»?`,
      message: "Ваши личные записи удалятся, общие останутся у семьи.",
      button: "Покинуть",
    }),
  );

  if (!isSure) {
    return;
  }

  try {
    await wrap(api.leave());
    onLeft();
  } catch {
    telegram.haptics.error();
    failure.set("Не получилось выйти из семьи. Попробуйте ещё раз.");
  }
}

export function reatomLeave(sources: FamilySources, openDeletion: () => void) {
  return action(async () => {
    sources.failure.set(undefined);

    if (!sources.isOwner()) {
      await wrap(leaveAfterConfirmation(sources));

      return;
    }

    // The last Member leaving deletes the Family, which takes typing its name.
    if ((sources.list.data() ?? []).length > 1) {
      sources.telegram.showAlert(
        "Сначала передайте роль владельца: нажмите на участника в списке.",
      );
    } else {
      openDeletion();
    }
  }, "family.leave").extend(withAsync());
}

export function reatomDeletion({ api, self, onLeft }: FamilySources) {
  const familyName = matchingName(() => self()?.familyName, "Название не совпадает");

  return reatomForm(
    { familyName: "" },
    {
      name: "family.deletion",
      schema: z.object({ familyName }),
      onSubmit: async (values) => {
        await wrap(api.deleteFamily(values.familyName));
        onLeft();
      },
    },
  );
}
