import { isAbort, wrap } from "@reatom/core";

import type { HapticImpact, HomeScreenStatus, PopupParams } from "./telegram.types.ts";

// Which action gets which feedback: docs/haptics.md.
export type Haptics = {
  select: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
  impact: (style: HapticImpact) => void;
};

export type HomeScreen = {
  addToHomeScreen: () => void;
  checkHomeScreenStatus: () => Promise<HomeScreenStatus>;
};

export type Fullscreen = { requestFullscreen: () => void; exitFullscreen: () => void };

// Enabled while a form on screen holds unsaved input, which closing the form would lose too.
export type ClosingConfirmation = {
  isClosingConfirmationEnabled: () => boolean;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
};

export type Dialogs = {
  // Resolves with the pressed button's id, or undefined when the popup is dismissed.
  showPopup: (params: PopupParams) => Promise<string | undefined>;
  showAlert: (message: string) => void;
};

// The button reads as destructive unless the step loses nothing, such as completing a Task.
export type Confirmation = {
  title: string;
  message: string;
  button: string;
  isDestructive?: boolean;
};

const confirmed = "confirm";

export async function isConfirmed(
  telegram: Pick<Dialogs, "showPopup"> & { haptics: Pick<Haptics, "warning"> },
  { title, message, button, isDestructive = true }: Confirmation,
): Promise<boolean> {
  if (isDestructive) {
    telegram.haptics.warning();
  }

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
  telegram: Pick<Dialogs, "showAlert"> & { haptics: Pick<Haptics, "error"> },
  { failure, call }: { failure: string; call: Promise<unknown> },
): Promise<boolean> {
  try {
    await wrap(call);

    return true;
  } catch (error) {
    if (isAbort(error)) {
      throw error;
    }

    telegram.haptics.error();
    telegram.showAlert(failure);

    return false;
  }
}
