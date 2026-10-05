import type { Clock } from "@/common/clock";

export type FakeClock = Clock & {
  set(iso: string): void;
};

export function createFakeClock(iso: string): FakeClock {
  let current = Date.parse(iso);

  return {
    now: () => current,
    set(next) {
      current = Date.parse(next);
    },
  };
}
