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

import type { GoalIcon, GoalOutcome } from "@family-hub/contract";

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

export const outcomeTitles: Record<GoalOutcome, string> = {
  fulfilled: "Исполнена",
  cancelled: "Отменена",
};
