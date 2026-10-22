import { reatomComponent } from "@reatom/react";
import { Link, UserPlus } from "lucide-react";

import { Button, FieldError, Section, SectionItem } from "@/common/ui";

import type { InvitesModel } from "../vm/invites.vm.ts";

export type InvitesProps = { model: InvitesModel };

export const Invites = reatomComponent(({ model }: InvitesProps) => {
  const isInviting = model.isInviting();

  return (
    <Section title="Приглашения" footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={UserPlus}
        title={isInviting ? "Создаём приглашение…" : "Пригласить в семью"}
        disabled={isInviting}
        onClick={model.invite}
      />
      {model.invites().map((invite) => (
        <SectionItem
          key={invite.id}
          icon={Link}
          title={`Приглашение ${invite.expiresOn}`}
          after={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                model.revoke(invite.id);
              }}
            >
              Отозвать
            </Button>
          }
        />
      ))}
    </Section>
  );
}, "Invites");
