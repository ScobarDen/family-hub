import { batch } from "@reatom/core";
import { clsx, type ClassValue } from "clsx";
import { addTransitionType, startTransition } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// React runs a View Transition only for an update inside startTransition, so Reatom has to notify
// the components synchronously instead of in its usual microtask. Without the API the update lands
// at once.
export function slideScreens(direction: string, update: () => void): void {
  startTransition(() => {
    addTransitionType(direction);
    batch(update, true);
  });
}
