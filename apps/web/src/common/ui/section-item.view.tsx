import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconBadge, type IconTone } from "./icon-badge.view.tsx";
import { PlainIcon } from "./plain-icon.view.tsx";
import { RoundPicture } from "./round-picture.view.tsx";
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
  // A photo in place of the icon, such as a Pet Avatar; the icon comes back if it fails to load.
  picture?: string;
  // A control of its own at the row's start, such as a CheckButton: the rest of the row still opens.
  control?: ReactNode;
  title: string;
  subtitle?: string;
  after?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isExpanded?: boolean;
  isPressed?: boolean;
  // A row with a control on its way out, such as a completed Task, folds away instead of vanishing.
  isCollapsed?: boolean;
};

export const sectionRowClass =
  "flex min-h-12 w-full items-center gap-3 pl-4 text-left [&+&>[data-slot=item-body]]:border-t";

function collapseClass(isCollapsed: boolean | undefined): string | undefined {
  if (isCollapsed === undefined) {
    return undefined;
  }

  return cn(
    "max-h-60 overflow-hidden transition-[max-height,min-height,opacity] duration-300 ease-out",
    isCollapsed &&
      "max-h-0 min-h-0 opacity-0 delay-200 motion-reduce:[transition:opacity_150ms_ease-out_200ms,max-height_0s_350ms,min-height_0s_350ms]",
  );
}

function leadingOf({
  icon,
  tone = "blue",
  iconVariant = "plain",
  isAlert = false,
  leading,
  picture,
}: SectionItemProps): ReactNode {
  if (leading !== undefined || icon === undefined) {
    return leading;
  }

  const iconLeading =
    iconVariant === "badge" ? (
      <IconBadge icon={icon} tone={tone} />
    ) : (
      <PlainIcon icon={icon} isAlert={isAlert} />
    );

  return picture === undefined ? (
    iconLeading
  ) : (
    <RoundPicture src={picture} fallback={iconLeading} />
  );
}

function bodyOf(
  { title, subtitle, after, isDestructive = false }: SectionItemProps,
  isSlot = true,
): ReactNode {
  return (
    <span
      data-slot={isSlot ? "item-body" : undefined}
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

function withControl(props: SectionItemProps, control: ReactNode): ReactNode {
  const { onClick, isCollapsed } = props;

  return (
    <div className={cn(sectionRowClass, collapseClass(isCollapsed))} inert={isCollapsed}>
      {control}
      {onClick === undefined ? (
        bodyOf(props)
      ) : (
        <button
          type="button"
          data-slot="item-body"
          className="flex min-w-0 flex-1 self-stretch border-border text-left focus-visible:-outline-offset-2 active:bg-muted press"
          onClick={onClick}
        >
          {bodyOf(props, false)}
        </button>
      )}
    </div>
  );
}

function plainRowOf(props: SectionItemProps): ReactNode {
  const {
    onClick,
    disabled = false,
    isAlert = false,
    isDestructive = false,
    isExpanded,
    isPressed,
  } = props;
  const content = (
    <>
      {leadingOf({ ...props, isAlert: isAlert || isDestructive })}
      {bodyOf(props)}
    </>
  );

  if (onClick === undefined) {
    return <div className={sectionRowClass}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        sectionRowClass,
        "focus-visible:-outline-offset-2 active:bg-muted aria-disabled:opacity-50 press",
      )}
      aria-disabled={disabled || undefined}
      aria-expanded={isExpanded}
      aria-pressed={isPressed}
      onClick={disabled ? undefined : onClick}
    >
      {content}
    </button>
  );
}

export function SectionItem(props: SectionItemProps) {
  return props.control === undefined ? plainRowOf(props) : withControl(props, props.control);
}
