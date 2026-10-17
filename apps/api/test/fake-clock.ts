import type { Clock } from "@/common/clock";

export type FakeClock = Clock & {
  set(iso: string): void;
  iso(): string;
};

export function createFakeClock(iso: string): FakeClock {
  let current = Date.parse(iso);

  return {
    now: () => current,
    set(next) {
      current = Date.parse(next);
    },
    iso: () => new Date(current).toISOString(),
  };
}
