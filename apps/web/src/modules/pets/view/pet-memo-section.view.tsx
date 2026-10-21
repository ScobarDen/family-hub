import { NotebookPen } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { PetMemoView } from "../pets.lib.ts";

const memoRows = [
  ["food", "Корм сейчас"],
  ["clinic", "Ветклиника"],
  ["important", "Важное"],
] as const;

type PetMemoSectionProps = { memo: PetMemoView; onEdit: (() => void) | undefined };

export function PetMemoSection({ memo, onEdit }: PetMemoSectionProps) {
  return (
    <Section title="Памятка" footer={memo.updated}>
      {memoRows.map(([key, label]) => (
        <SectionItem key={key} title={memo[key] ?? "—"} subtitle={label} />
      ))}
      {onEdit !== undefined && (
        <SectionItem icon={NotebookPen} tone="blue" title="Изменить памятку" onClick={onEdit} />
      )}
    </Section>
  );
}
