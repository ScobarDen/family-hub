import { RotateCw } from "lucide-react";

import { SectionItem } from "./section-item.view.tsx";
import { Section } from "./section.view.tsx";

export function LoadState({ failure, onRetry }: { failure: string; onRetry: () => void }) {
  return (
    <Section>
      <SectionItem title={failure} />
      <SectionItem icon={RotateCw} title="Повторить" onClick={onRetry} />
    </Section>
  );
}
