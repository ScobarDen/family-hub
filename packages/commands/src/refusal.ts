import type { DraftRefusal } from "@family-hub/contract";

export const draftRefusalTexts: Record<DraftRefusal, string> = {
  INVALID_REQUEST:
    "Не получилось создать: в черновике не сходятся даты или поля. Поправьте его в «Изменить».",
  RECIPIENTS_NOT_ALLOWED:
    "Не получилось создать: кого-то из получателей уже нет в семье. Выберите получателей в «Изменить».",
  PET_NOT_FOUND: "Не получилось создать: этого питомца уже нет в семье.",
  PET_ARCHIVED: "Не получилось создать: питомец в архиве, его журнал только для чтения.",
};
