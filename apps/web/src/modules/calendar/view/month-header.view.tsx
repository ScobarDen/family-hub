import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/common/ui";

type MonthHeaderProps = { title: string; onPrevious: () => void; onNext: () => void };

export function MonthHeader({ title, onPrevious, onNext }: MonthHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <Button size="icon" variant="ghost" aria-label="Предыдущий месяц" onClick={onPrevious}>
        <ChevronLeft />
      </Button>
      <h2 className="font-semibold">{title}</h2>
      <Button size="icon" variant="ghost" aria-label="Следующий месяц" onClick={onNext}>
        <ChevronRight />
      </Button>
    </div>
  );
}
