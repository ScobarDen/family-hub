import { reatomComponent } from "@reatom/react";

import { PersonAvatar, SectionItem } from "@/common/ui";

import type { FamilyModel } from "../vm/family.vm.ts";

export type FamilyProps = { model: FamilyModel };

export const Family = reatomComponent(({ model }: FamilyProps) => {
  const loadFailure = model.loadFailure();
  const isBusy = model.isBusy();

  if (loadFailure !== undefined) {
    return <SectionItem title={loadFailure} />;
  }

  return model.members().map((member) => (
    <SectionItem
      key={member.id}
      leading={<PersonAvatar member={member} />}
      title={member.name}
      subtitle={member.role}
      disabled={isBusy}
      onClick={
        member.isManageable
          ? () => {
              model.manage(member.id);
            }
          : undefined
      }
    />
  ));
}, "Family");
