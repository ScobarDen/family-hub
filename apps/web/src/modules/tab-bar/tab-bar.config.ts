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

import type { IconTone } from "@/common/ui";

export const moduleTitles: Record<AppModule, string> = {
  feed: "Лента",
  plans: "Планы",
  calendar: "Календарь",
  pet: "Питомец",
  goals: "Цели",
  albums: "Альбомы",
  recipes: "Рецепты",
};

export const moduleIcons: Record<AppModule, LucideIcon> = {
  feed: Newspaper,
  plans: ListChecks,
  calendar: CalendarDays,
  pet: PawPrint,
  goals: PiggyBank,
  albums: Images,
  recipes: CookingPot,
};

export const moduleTones: Record<AppModule, IconTone> = {
  feed: "blue",
  plans: "green",
  calendar: "red",
  pet: "orange",
  goals: "teal",
  albums: "violet",
  recipes: "pink",
};
