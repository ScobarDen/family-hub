import { isAbort, wrap } from "@reatom/core";

import type { PopupParams } from "./telegram.types.ts";

export type Dialogs = {
  // Resolves with the pressed button's id, or undefined when the popup is dismissed.
  showPopup: (params: PopupParams) => Promise<string | undefined>;
  showAlert: (message: string) => void;
};

// A call the Member started that fails gets a word instead of silence.
export async function didSucceedOrAlert(
  telegram: Pick<Dialogs, "showAlert">,
  { failure, call }: { failure: string; call: Promise<unknown> },
): Promise<boolean> {
  try {
    await wrap(call);

    return true;
  } catch (error) {
    if (isAbort(error)) {
      throw error;
    }

    telegram.showAlert(failure);

    return false;
  }
}
