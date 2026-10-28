import { reatomComponent } from "@reatom/react";
import { Link, LoaderCircle, UserPlus } from "lucide-react";

import { Button, FieldError, FormDrawer, Section, SectionItem } from "@/common/ui";

import type { InvitesModel } from "../vm/invites.vm.ts";

export type InvitesProps = { model: InvitesModel };

const RevokeConfirmation = reatomComponent(
  ({ model }: InvitesProps) => (
    <FormDrawer
      open={model.isConfirmingRevoke()}
      title="Отозвать приглашение?"
      onClose={model.cancelRevoke}
    >
      <div className="flex flex-col gap-4 px-5 pb-6">
        <p className="text-subhead text-muted-foreground">
          Ссылка перестанет работать. Чтобы позвать снова, понадобится новое приглашение.
        </p>
        <Button size="lg" variant="destructive" onClick={model.confirmRevoke}>
          Отозвать
        </Button>
        <Button size="lg" variant="ghost" onClick={model.cancelRevoke}>
          Отмена
        </Button>
      </div>
    </FormDrawer>
  ),
  "RevokeConfirmation",
);

export const Invites = reatomComponent(({ model }: InvitesProps) => {
  const isInviting = model.isInviting();

  return (
    <>
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
      <RevokeConfirmation model={model} />
    </>
  );
}, "Invites");
