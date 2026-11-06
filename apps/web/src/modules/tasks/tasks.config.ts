import type { ReminderOffset } from "@family-hub/contract";

export const repeatTitles = {
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
  yearly: "Каждый год",
};

export const repeatChoices = Object.entries(repeatTitles).map(([value, title]) => ({
  value,
  title,
}));

export const offsetTitles: Record<ReminderOffset, string> = {
  "at-start": "в момент",
  "15m": "за 15 минут",
  "1h": "за час",
  "1d": "за день",
  "1w": "за неделю",
};
