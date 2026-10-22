import type { PetSex, PetSpecies } from "@family-hub/contract";

export const speciesTitles: Record<PetSpecies, string> = {
  dog: "Собака",
  cat: "Кошка",
  bird: "Птица",
  rodent: "Грызун",
  fish: "Рыба",
  reptile: "Рептилия",
  other: "Другое",
};

export const sexTitles: Record<PetSex, string> = {
  male: "Мальчик",
  female: "Девочка",
};

export const memoFields = [
  { key: "food", label: "Корм сейчас", placeholder: "Что и сколько раз в день" },
  { key: "clinic", label: "Ветклиника", placeholder: "Адрес, телефон, врач" },
  { key: "important", label: "Важное", placeholder: "Аллергии, страхи, привычки" },
] as const;
