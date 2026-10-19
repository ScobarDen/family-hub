import {
  CalendarDays,
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
};

export const moduleIcons: Record<AppModule, LucideIcon> = {
  feed: Newspaper,
  plans: ListChecks,
  calendar: CalendarDays,
  pet: PawPrint,
  goals: PiggyBank,
  albums: Images,
};

export const moduleTones: Record<AppModule, IconTone> = {
  feed: "blue",
  plans: "green",
  calendar: "red",
  pet: "orange",
  goals: "teal",
  albums: "violet",
};
