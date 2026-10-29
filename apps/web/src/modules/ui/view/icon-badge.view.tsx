import type { LucideIcon } from "lucide-react";

import { cn } from "../ui.lib.ts";

const tones = {
  blue: "bg-badge-blue",
  green: "bg-badge-green",
  orange: "bg-badge-orange",
  red: "bg-badge-red",
  violet: "bg-badge-violet",
  teal: "bg-badge-teal",
  pink: "bg-badge-pink",
  gray: "bg-badge-gray",
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
