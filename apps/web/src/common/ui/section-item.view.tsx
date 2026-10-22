import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconBadge, type IconTone } from "./icon-badge.view.tsx";
import { PlainIcon } from "./plain-icon.view.tsx";
import { cn } from "./ui.lib.ts";

type SectionItemProps = {
  icon?: LucideIcon;
  tone?: IconTone;
  // A badge is for a colour the Member chose (a Savings Goal); every other icon stays plain.
  iconVariant?: "plain" | "badge";
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  after?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

const row =
  "flex min-h-12 w-full items-center gap-3 pl-4 text-left [&+&>[data-slot=item-body]]:border-t";

function leadingOf({
  icon,
  tone = "blue",
  iconVariant = "plain",
  leading,
}: SectionItemProps): ReactNode {
  if (leading !== undefined || icon === undefined) {
    return leading;
  }

  return iconVariant === "badge" ? (
    <IconBadge icon={icon} tone={tone} />
  ) : (
    <PlainIcon icon={icon} tone={tone} />
  );
}

export function SectionItem(props: SectionItemProps) {
  const { title, subtitle, after, onClick, disabled = false } = props;
  const content = (
    <>
      {leadingOf(props)}
      <span
        data-slot="item-body"
        className="flex min-h-12 flex-1 items-center gap-3 border-border py-2.5 pr-4"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="leading-snug">{title}</span>
          {subtitle !== undefined && (
            <span className="text-[0.8125rem] leading-snug whitespace-pre-line text-muted-foreground">
              {subtitle}
            </span>
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
