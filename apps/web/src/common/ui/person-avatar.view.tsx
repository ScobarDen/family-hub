import { cn } from "./ui.lib.ts";

const tints = ["bg-person-1", "bg-person-2", "bg-person-3", "bg-person-4"] as const;

// The tint follows the name, so a Member keeps one colour on every screen and every device.
function tintOf(name: string): string {
  const sum = Array.from(name, (char) => char.codePointAt(0) ?? 0).reduce(
    (total, code) => total + code,
    0,
  );

  return tints[sum % tints.length] ?? tints[0];
}

export function PersonAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-foreground",
        tintOf(name),
      )}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
