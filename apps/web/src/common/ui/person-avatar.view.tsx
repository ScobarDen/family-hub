import { useState } from "react";

import { cn } from "./ui.lib.ts";

const tints = ["bg-person-1", "bg-person-2", "bg-person-3", "bg-person-4"] as const;

export type AvatarMember = { name: string; profilePicture: string | null };

// The tint follows the name, so a Member keeps one colour on every screen and every device.
function tintOf(name: string): string {
  const sum = Array.from(name, (char) => char.codePointAt(0) ?? 0).reduce(
    (total, code) => total + code,
    0,
  );

  return tints[sum % tints.length] ?? tints[0];
}

export function PersonAvatar({ member, className }: { member: AvatarMember; className?: string }) {
  const [failedPicture, setFailedPicture] = useState<string>();
  const picture = member.profilePicture === failedPicture ? null : member.profilePicture;

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-foreground",
        tintOf(member.name),
        className,
      )}
    >
      {picture === null ? (
        member.name.trim().slice(0, 1).toUpperCase()
      ) : (
        <img
          src={picture}
          alt=""
          className="size-full object-cover"
          onError={() => {
            setFailedPicture(picture);
          }}
        />
      )}
    </span>
  );
}
