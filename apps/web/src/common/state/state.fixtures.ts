import type { Slide } from "./state.lib.ts";

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
