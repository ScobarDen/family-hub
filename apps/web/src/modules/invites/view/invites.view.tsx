import { reatomComponent } from "@reatom/react";
import { Link, LoaderCircle, UserPlus } from "lucide-react";

import { Button, FieldError, Section, SectionItem } from "@/common/ui";

import type { InvitesModel } from "../vm/invites.vm.ts";

export type InvitesProps = { model: InvitesModel };

export const Invites = reatomComponent(({ model }: InvitesProps) => {
  const isInviting = model.isInviting();

  return (
    <Section title="Приглашения" footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={UserPlus}
        title="Пригласить в семью"
        after={
          isInviting ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin text-muted-foreground" />
          ) : undefined
        }
        disabled={isInviting}
        onClick={model.invite}
      />
      {model.invites().map((invite) => (
        <SectionItem
          key={invite.id}
          icon={Link}
          title={invite.title}
          after={
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Отозвать: ${invite.title}`}
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
