import { action, withAsync, wrap } from "@reatom/core";

import type { FamilyMember } from "@family-hub/contract";

import { withoutId } from "@/common/records";
import { isConfirmed } from "@/common/telegram";

import type { FamilySources } from "./family-sources.vm.ts";

async function remove({ api, telegram, list, failure }: FamilySources, member: FamilyMember) {
  const isSure = await wrap(
    isConfirmed(telegram, {
      title: `Исключить: ${member.name}`,
      message:
        "Участник больше не увидит семью, а бот сообщит ему об этом. Личные записи участника удалятся, общие перейдут вам.",
      button: "Исключить",
    }),
  );

  if (!isSure) {
    return;
  }

  try {
    await wrap(api.remove(member.id));
    list.data.set(withoutId(list.data() ?? [], member.id));
  } catch {
    telegram.haptics.error();
    failure.set("Не получилось исключить участника. Попробуйте ещё раз.");
  }
}

async function handOver({ api, telegram, list, failure }: FamilySources, member: FamilyMember) {
  const isSure = await wrap(
    isConfirmed(telegram, {
      title: `Передать роль: ${member.name}`,
      message:
        "Новый владелец сможет приглашать, исключать и удалять семью. Вы останетесь в семье участником.",
      button: "Передать роль",
    }),
  );

  if (!isSure) {
    return;
  }

  try {
    await wrap(api.handOver(member.id));
    list.data.set(
      list.data()?.map((other) => ({ ...other, isFamilyOwner: other.id === member.id })),
    );
  } catch {
    telegram.haptics.error();
    failure.set("Не получилось передать роль владельца. Попробуйте ещё раз.");
  }
}

export function reatomManage(sources: FamilySources) {
  return action(async (memberId: string) => {
    const member = sources.list.data()?.find(({ id }) => id === memberId);

    if (!member) {
      return;
    }

    sources.failure.set(undefined);

    const choice = await wrap(
      sources.telegram.showPopup({
        title: member.name,
        message: "Что сделать с участником?",
        buttons: [
          { id: "hand-over", type: "default", text: "Сделать владельцем" },
          { id: "remove", type: "destructive", text: "Исключить" },
          { id: "cancel", type: "cancel" },
        ],
      }),
    );

    if (choice === "hand-over") {
      await wrap(handOver(sources, member));
    } else if (choice === "remove") {
      await wrap(remove(sources, member));
    }
  }, "family.manage").extend(withAsync());
}
