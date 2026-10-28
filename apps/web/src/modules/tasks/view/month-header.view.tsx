import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/common/ui";

type MonthHeaderProps = { title: string; onPrevious: () => void; onNext: () => void };

export function MonthHeader({ title, onPrevious, onNext }: MonthHeaderProps) {
  return (
    <div className="flex items-center justify-between py-1 pl-3">
      <h2 className="text-headline font-semibold tracking-tight capitalize">{title}</h2>
      <div className="flex">
        <Button size="icon-lg" variant="ghost" aria-label="Предыдущий месяц" onClick={onPrevious}>
          <ChevronLeft />
        </Button>
        <Button size="icon-lg" variant="ghost" aria-label="Следующий месяц" onClick={onNext}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
