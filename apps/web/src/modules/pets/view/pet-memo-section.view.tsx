import { NotebookPen } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import { memoFields } from "../pets.config.ts";
import type { PetMemoView } from "../pets.lib.ts";

type PetMemoSectionProps = { memo: PetMemoView; onEdit: (() => void) | undefined };

export function PetMemoSection({ memo, onEdit }: PetMemoSectionProps) {
  return (
    <Section title="Памятка" footer={memo.updated}>
      {memoFields.map(({ key, label }) => (
        <SectionItem key={key} title={memo[key] ?? "—"} subtitle={label} />
      ))}
      {onEdit !== undefined && (
        <SectionItem icon={NotebookPen} title="Изменить памятку" onClick={onEdit} />
      )}
    </Section>
  );
}
