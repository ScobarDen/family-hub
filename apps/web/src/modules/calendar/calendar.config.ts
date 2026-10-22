export const repeatTitles = {
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
  yearly: "Каждый год",
};

export const repeatChoices = Object.entries(repeatTitles).map(([value, title]) => ({
  value,
  title,
}));
