import { wrap } from "@reatom/core";

import { detached } from "@/modules/changes";
import {
  isConfirmed,
  type ClosingConfirmation,
  type Dialogs,
  type Haptics,
} from "@/modules/telegram";

type Discarding = Pick<ClosingConfirmation, "isClosingConfirmationEnabled"> &
  Pick<Dialogs, "showPopup"> & { haptics: Pick<Haptics, "warning"> };

type Steps = { canGoBack: () => boolean; closesInPlace: () => boolean; back: () => void };

// Its private field makes the type nominal: only this file builds one, so every Back the app
// takes inside a module goes through the question about unsaved input.
export class NestedBack {
  readonly canGoBack: () => boolean;
  readonly closesInPlace: () => boolean;
  readonly #back: () => void;

  constructor({ canGoBack, closesInPlace, back }: Steps) {
    this.canGoBack = canGoBack;
    this.closesInPlace = closesInPlace;
    this.#back = back;
  }

  readonly back = (): void => {
    this.#back();
  };
}

// A swipe, the overlay, Escape, «Отмена» and Telegram Back all close a form through its module's
// back, so closing one that holds unsaved input asks there once for all of them.
export function reatomNestedBack({
  name,
  telegram,
  canGoBack,
  closesInPlace,
  back,
}: Steps & { name: string; telegram: Discarding }): NestedBack {
  const asking = detached(async () => {
    const isUnsaved = closesInPlace() && telegram.isClosingConfirmationEnabled();

    if (
      isUnsaved &&
      !(await wrap(
        isConfirmed(telegram, {
          title: "Отменить изменения?",
          message: "Введённое в форме не сохранится.",
          button: "Не сохранять",
        }),
      ))
    ) {
      return;
    }

    back();
  }, name);

  return new NestedBack({ canGoBack, closesInPlace, back: asking });
}

export function firstNestedBack(...nested: NestedBack[]): NestedBack {
  function stepping(): NestedBack | undefined {
    return nested.find((one) => one.canGoBack());
  }

  return new NestedBack({
    canGoBack: () => stepping() !== undefined,
    closesInPlace: () => stepping()?.closesInPlace() === true,
    back: () => {
      stepping()?.back();
    },
  });
}
