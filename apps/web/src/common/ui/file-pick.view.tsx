import type { ChangeEvent, ReactNode } from "react";

import { cn } from "./ui.lib.ts";

type FilePickProps = { className: string; onPick: (files: Blob[]) => void; children: ReactNode };

// The input stays in the tab order, visually hidden, so a keyboard reaches the picker too.
export function FilePick({ className, onPick, children }: FilePickProps) {
  function pick(event: ChangeEvent<HTMLInputElement>) {
    onPick([...(event.target.files ?? [])]);
    event.target.value = "";
  }

  return (
    <label className={cn("cursor-pointer focus-within:ring-2 focus-within:ring-ring", className)}>
      {children}
      <input type="file" accept="image/*" multiple className="sr-only" onChange={pick} />
    </label>
  );
}
