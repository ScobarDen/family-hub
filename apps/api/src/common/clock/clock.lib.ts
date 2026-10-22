export type Clock = {
  now(): number;
};

export const systemClock: Clock = {
  now: () => Date.now(),
};

// A Member whose zone the Mini App has not reported yet lives on UTC days.
export const fallbackTimeZone = "UTC";
