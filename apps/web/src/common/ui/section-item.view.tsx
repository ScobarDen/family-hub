import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconBadge, type IconTone } from "./icon-badge.view.tsx";
import { PlainIcon } from "./plain-icon.view.tsx";
import { cn } from "./ui.lib.ts";

type SectionItemProps = {
  icon?: LucideIcon;
  // A badge is for a colour the Member chose (a Savings Goal); every other icon stays plain.
  iconVariant?: "plain" | "badge";
  tone?: IconTone;
  isAlert?: boolean;
  // A row that destroys something reads red as a whole, not only its icon.
  isDestructive?: boolean;
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
  isAlert = false,
  leading,
}: SectionItemProps): ReactNode {
  if (leading !== undefined || icon === undefined) {
    return leading;
  }

  return iconVariant === "badge" ? (
    <IconBadge icon={icon} tone={tone} />
  ) : (
    <PlainIcon icon={icon} isAlert={isAlert} />
  );
}

function bodyOf({ title, subtitle, after, isDestructive = false }: SectionItemProps): ReactNode {
  return (
    <span
      data-slot="item-body"
      className="flex min-h-12 flex-1 items-center gap-3 border-border py-2.5 pr-4"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("leading-snug break-words", isDestructive && "text-destructive-text")}>
          {title}
        </span>
        {subtitle !== undefined && (
          <span className="text-[0.8125rem] leading-snug whitespace-pre-line text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      {after}
    </span>
  );
}

export function SectionItem(props: SectionItemProps) {
  const { onClick, disabled = false, isAlert = false, isDestructive = false } = props;
  const content = (
    <>
      {leadingOf({ ...props, isAlert: isAlert || isDestructive })}
      {bodyOf(props)}
    </>
  );

  if (onClick === undefined) {
    return <div className={row}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        row,
        "focus-visible:-outline-offset-2 active:bg-muted aria-disabled:opacity-50",
      )}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    >
      {content}
    </button>
  );
}
