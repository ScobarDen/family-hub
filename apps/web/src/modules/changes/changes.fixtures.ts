import type { Slide } from "./changes.lib.ts";

export function fakeSlide(): { slides: string[]; slide: Slide } {
  const slides: string[] = [];

  return {
    slides,
    slide: (direction, update) => {
      slides.push(direction);
      update();
    },
  };
}
