import { RotateCw } from "lucide-react";

import { SectionItem } from "./section-item.view.tsx";
import { Section } from "./section.view.tsx";

// Still loading until a failure is named; a failure always offers a way out.
export function LoadState({ failure, onRetry }: { failure?: string; onRetry?: () => void }) {
  return (
    <Section>
      <SectionItem title={failure ?? "Загружаем…"} />
      {failure !== undefined && onRetry !== undefined && (
        <SectionItem icon={RotateCw} title="Повторить" onClick={onRetry} />
      )}
    </Section>
  );
}
