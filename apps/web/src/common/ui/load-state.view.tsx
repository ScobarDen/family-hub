import { SectionItem } from "./section-item.view.tsx";
import { Section } from "./section.view.tsx";

// Still loading until a failure is named.
export function LoadState({ failure }: { failure?: string }) {
  return (
    <Section>
      <SectionItem title={failure ?? "Загружаем…"} />
    </Section>
  );
}
