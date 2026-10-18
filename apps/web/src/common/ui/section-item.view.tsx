import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconBadge, type IconTone } from "./icon-badge.view.tsx";
import { cn } from "./ui.lib.ts";

type SectionItemProps = {
  icon?: LucideIcon;
  tone?: IconTone;
  title: string;
  subtitle?: string;
  after?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

const row =
  "flex min-h-11 w-full items-center gap-3 pl-4 text-left [&+&>[data-slot=item-body]]:border-t";

export function SectionItem({
  icon,
  tone = "blue",
  title,
  subtitle,
  after,
  onClick,
  disabled = false,
}: SectionItemProps) {
  const content = (
    <>
      {icon !== undefined && <IconBadge icon={icon} tone={tone} />}
      <span
        data-slot="item-body"
        className="flex min-h-11 flex-1 items-center gap-3 border-border py-2 pr-4"
      >
        <span className="flex flex-1 flex-col">
          <span>{title}</span>
          {subtitle !== undefined && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </span>
        {after}
      </span>
    </>
  );

  if (onClick === undefined) {
    return <div className={row}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(row, "active:bg-muted disabled:opacity-50")}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
