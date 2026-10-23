import {
  CalendarDays,
  CookingPot,
  Images,
  ListChecks,
  Newspaper,
  PawPrint,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

import type { AppModule } from "@family-hub/contract";

export const sectionTitles: Record<AppModule, string> = {
  feed: "Лента",
  plans: "Планы",
  calendar: "Календарь",
  pet: "Питомцы",
  goals: "Цели",
  albums: "Альбомы",
  recipes: "Рецепты",
};

export const sectionIcons: Record<AppModule, LucideIcon> = {
  feed: Newspaper,
  plans: ListChecks,
  calendar: CalendarDays,
  pet: PawPrint,
  goals: PiggyBank,
  albums: Images,
  recipes: CookingPot,
};

// Whole class names, so Tailwind finds them in the source.
export const sectionColors: Record<AppModule, string> = {
  feed: "text-section-feed",
  plans: "text-section-plans",
  calendar: "text-section-calendar",
  pet: "text-section-pet",
  goals: "text-section-goals",
  albums: "text-section-albums",
  recipes: "text-section-recipes",
};
