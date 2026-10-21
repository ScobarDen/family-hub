import { Pencil } from "lucide-react";

import { Button, cn } from "@/common/ui";

import type { PetCard } from "../pets.lib.ts";

type PetHeaderProps = { card: PetCard; onEdit: (() => void) | undefined };

const shortFact = 22;

export function PetHeader({ card, onEdit }: PetHeaderProps) {
  return (
    <section className="px-4 pb-7">
      <div className="overflow-hidden rounded-2xl bg-card">
        {card.avatar !== undefined && (
          <img src={card.avatar} alt={card.name} className="aspect-[4/3] w-full object-cover" />
        )}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-[1.375rem] leading-tight font-semibold tracking-tight">
              {card.name}
            </h2>
            <p className="text-[0.9375rem] text-muted-foreground">{card.subtitle}</p>
          </div>
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
                className={cn(
                  "flex min-w-0 flex-col gap-0.5",
                  fact.value.length > shortFact && "col-span-2",
                )}
              >
                <dt className="text-[0.8125rem] text-muted-foreground">{fact.label}</dt>
                <dd className="break-words">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
