import { isAbort, wrap } from "@reatom/core";

import type { PopupParams } from "./telegram.types.ts";

export type Dialogs = {
  // Resolves with the pressed button's id, or undefined when the popup is dismissed.
  showPopup: (params: PopupParams) => Promise<string | undefined>;
  showAlert: (message: string) => void;
};

// The button reads as destructive unless the step loses nothing, such as completing a Plan.
export type Confirmation = {
  title: string;
  message: string;
  button: string;
  isDestructive?: boolean;
};

const confirmed = "confirm";

export async function isConfirmed(
  telegram: Pick<Dialogs, "showPopup">,
  { title, message, button, isDestructive = true }: Confirmation,
): Promise<boolean> {
  const choice = await wrap(
    telegram.showPopup({
      title,
      message,
      buttons: [
        { id: confirmed, type: isDestructive ? "destructive" : "default", text: button },
        { id: "cancel", type: "cancel" },
      ],
    }),
  );

  return choice === confirmed;
}

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
