import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { Button, cn } from "@/common/ui";

import type { PetCard } from "../pets.lib.ts";

type PetHeaderProps = { card: PetCard; avatar: ReactNode; onEdit: (() => void) | undefined };

const shortFact = 22;
// A number with no spaces cannot wrap, so a long one (a chip number) takes the whole row.
const shortWord = 10;

function isWide(value: string): boolean {
  return value.length > shortFact || (!value.includes(" ") && value.length > shortWord);
}

export function PetHeader({ card, avatar, onEdit }: PetHeaderProps) {
  return (
    <section className="px-4 pb-7">
      <div className="overflow-hidden rounded-2xl bg-card">
        {avatar}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {/* The screen's title already names the Pet, so the card opens with what it is. */}
          <p className="min-w-0 flex-1 self-center text-[1.0625rem] font-medium">{card.subtitle}</p>
          {onEdit !== undefined && (
            <Button size="icon" variant="ghost" aria-label="Изменить" onClick={onEdit}>
              <Pencil />
            </Button>
          )}
        </div>
        {card.facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 pt-3 pb-4">
            {card.facts.map((fact) => (
              <div
                key={fact.label}
                className={cn("flex min-w-0 flex-col gap-0.5", isWide(fact.value) && "col-span-2")}
              >
                <dt className="text-[0.8125rem] text-muted-foreground">{fact.label}</dt>
                <dd className="break-words tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
