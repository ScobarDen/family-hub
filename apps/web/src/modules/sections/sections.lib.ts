import { appModule, type AppModule, type SlotModule } from "@family-hub/contract";

export type SectionOrder = { slotted: SlotModule[]; rest: AppModule[] };

// The «Разделы» order, which the sidebar follows too: the Member's slots, then the rest as the app lists them.
export function sectionOrderOf(slots: SlotModule[]): SectionOrder {
  const slotted: AppModule[] = slots;

  return { slotted: slots, rest: appModule.options.filter((module) => !slotted.includes(module)) };
}
