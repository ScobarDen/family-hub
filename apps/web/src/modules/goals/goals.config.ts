import {
  Baby,
  Car,
  Gift,
  GraduationCap,
  Heart,
  House,
  Laptop,
  PawPrint,
  PiggyBank,
  Plane,
  TreePalm,
  Sofa,
  type LucideIcon,
} from "lucide-react";

import type { GoalColor, GoalIcon, GoalOutcome } from "@family-hub/contract";

export const goalIcons: Record<GoalIcon, LucideIcon> = {
  plane: Plane,
  palmtree: TreePalm,
  house: House,
  car: Car,
  sofa: Sofa,
  laptop: Laptop,
  gift: Gift,
  baby: Baby,
  "graduation-cap": GraduationCap,
  heart: Heart,
  "paw-print": PawPrint,
  "piggy-bank": PiggyBank,
};

export const goalIconTitles: Record<GoalIcon, string> = {
  plane: "Самолёт",
  palmtree: "Пальма",
  house: "Дом",
  car: "Машина",
  sofa: "Диван",
  laptop: "Ноутбук",
  gift: "Подарок",
  baby: "Ребёнок",
  "graduation-cap": "Учёба",
  heart: "Сердце",
  "paw-print": "Питомец",
  "piggy-bank": "Копилка",
};

export const goalColorTitles: Record<GoalColor, string> = {
  blue: "Синий",
  green: "Зелёный",
  orange: "Оранжевый",
  red: "Красный",
  violet: "Фиолетовый",
  teal: "Бирюзовый",
  pink: "Розовый",
};

export const outcomeTitles: Record<GoalOutcome, string> = {
  fulfilled: "Исполнена",
  cancelled: "Отменена",
};
