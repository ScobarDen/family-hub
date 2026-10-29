export const msPerSecond = 1000;
export const initDataMaxAgeMs = 3_600_000;
// Telegram signs auth_date with its own clock; allow it to run a little ahead of the Worker's.
export const initDataClockSkewMs = 300_000;
// A Telegram Login is posted the moment it is signed, so a short window limits a leaked one.
export const telegramLoginMaxAgeMs = 300_000;
export const sessionLifetimeMs = 86_400_000;
// 90 days.
export const deviceLifetimeMs = 7_776_000_000;
// last_used_at is a D1 write, so a Device in daily use costs one row a day.
export const deviceTouchIntervalMs = sessionLifetimeMs;
