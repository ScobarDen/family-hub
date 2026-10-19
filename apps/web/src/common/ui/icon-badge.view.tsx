import type { LucideIcon } from "lucide-react";

import { cn } from "./ui.lib.ts";

const tones = {
  blue: "bg-sky-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  gray: "bg-gray-400",
} as const;

export type IconTone = keyof typeof tones;

type IconBadgeProps = { icon: LucideIcon; tone: IconTone };

export function IconBadge({ icon: Icon, tone }: IconBadgeProps) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-white android:rounded-full",
        tones[tone],
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
