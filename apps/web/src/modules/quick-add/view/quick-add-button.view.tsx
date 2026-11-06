import { Plus } from "lucide-react";

import type { QuickAddModel } from "../quick-add.vm.ts";

export function QuickAddButton({ model }: { model: QuickAddModel }) {
  return (
    <button
      type="button"
      aria-label="Добавить"
      aria-haspopup="dialog"
      className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md select-none"
      onClick={model.open}
    >
      <Plus className="size-6" aria-hidden />
    </button>
  );
}
