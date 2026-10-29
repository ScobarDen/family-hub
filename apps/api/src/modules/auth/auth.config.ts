export const msPerSecond = 1000;
export const initDataMaxAgeMs = 3_600_000;
// Telegram signs auth_date with its own clock; allow it to run a little ahead of the Worker's.
export const initDataClockSkewMs = 300_000;
export const sessionLifetimeMs = 86_400_000;
