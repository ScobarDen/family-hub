import {
  CircleCheckBig,
  CookingPot,
  Images,
  Newspaper,
  PawPrint,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

import type { AppModule } from "@family-hub/contract";

export const sectionTitles: Record<AppModule, string> = {
  feed: "Лента",
  tasks: "Дела",
  pet: "Питомцы",
  goals: "Цели",
  albums: "Альбомы",
  recipes: "Рецепты",
};

export const sectionIcons: Record<AppModule, LucideIcon> = {
  feed: Newspaper,
  tasks: CircleCheckBig,
  pet: PawPrint,
  goals: PiggyBank,
  albums: Images,
  recipes: CookingPot,
};

// Whole class names, so Tailwind finds them in the source.
export const sectionColors: Record<AppModule, string> = {
  feed: "text-section-feed",
  tasks: "text-section-tasks",
  pet: "text-section-pet",
  goals: "text-section-goals",
  albums: "text-section-albums",
  recipes: "text-section-recipes",
};
