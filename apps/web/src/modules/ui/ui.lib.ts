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

const slideFrom = { forward: "100%", back: "-100%" } as const;

// Content that replaces a skeleton fades in only at launch; once the Member moves around it lands at once.
export const hasSlid = atom(false, "screens.hasSlid");

// The new screen renders synchronously, so it can slide in from the side before it is first painted.
export function slideScreens(direction: keyof typeof slideFrom, update: () => void): void {
  hasSlid.set(true);
  flushSync(() => {
    batch(update, true);
  });

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  document
    .querySelector("[data-screen]")
    ?.animate(
      { translate: [`${slideFrom[direction]} 0`, "0 0"] },
      { duration: 250, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
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
