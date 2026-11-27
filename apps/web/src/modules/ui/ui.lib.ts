import { atom, batch } from "@reatom/core";
import { clsx, type ClassValue } from "clsx";
import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import { extendTailwindMerge } from "tailwind-merge";

// Without the scale tailwind-merge takes `text-footnote` for a colour and drops `text-foreground` beside it.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["tab-label", "footnote", "subhead", "headline", "value", "title", "figure"] },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const screenEntrances = {
  forward: { keyframes: { translate: ["100% 0", "0 0"] }, duration: 250 },
  back: { keyframes: { translate: ["-100% 0", "0 0"] }, duration: 250 },
  fade: { keyframes: { opacity: [0, 1] }, duration: 150 },
} satisfies Record<string, { keyframes: PropertyIndexedKeyframes; duration: number }>;

// Content that replaces a skeleton fades in only at launch; once the Member moves around it lands at once.
export const hasSlid = atom(false, "screens.hasSlid");

// The new screen renders synchronously, so it can slide or fade in before it is first painted.
export function slideScreens(transition: keyof typeof screenEntrances, update: () => void): void {
  hasSlid.set(true);
  flushSync(() => {
    batch(update, true);
  });

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const { keyframes, duration } = screenEntrances[transition];

  document
    .querySelector("[data-screen]")
    ?.animate(keyframes, { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
}

// Runs after the render that marked the fields of a rejected submit invalid, so focus can land on one.
export function useFocusOnInvalid(rejection: unknown): RefObject<HTMLFormElement | null> {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (rejection === undefined) {
      return;
    }

    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [rejection]);

  return form;
}
