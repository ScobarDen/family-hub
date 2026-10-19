import { reatomComponent } from "@reatom/react";
import { Crown, User } from "lucide-react";

import { SectionItem } from "@/common/ui";

import type { FamilyModel } from "./vm/family.vm.ts";

export type FamilyProps = { model: FamilyModel };

export const Family = reatomComponent(({ model }: FamilyProps) => {
  const failure = model.failure();

  if (failure !== undefined) {
    return <SectionItem title={failure} />;
  }

  return model
    .members()
    .map((member) => (
      <SectionItem
        key={member.id}
        icon={member.isFamilyOwner ? Crown : User}
        tone={member.isFamilyOwner ? "orange" : "blue"}
        title={member.name}
        subtitle={member.role}
      />
    ));
}, "Family");
