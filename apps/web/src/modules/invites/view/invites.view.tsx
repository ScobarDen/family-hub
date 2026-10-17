import { reatomComponent } from "@reatom/react";
import { UserPlus } from "lucide-react";

import { Button, FieldError } from "@/common/ui";

import type { InvitesModel } from "../vm/invites.vm.ts";

export type InvitesProps = { model: InvitesModel };

export const Invites = reatomComponent(({ model }: InvitesProps) => {
  const isInviting = model.isInviting();
  const invites = model.invites();

  return (
    <section className="flex w-full max-w-xs flex-col gap-3">
      <Button size="lg" disabled={isInviting} onClick={model.invite}>
        <UserPlus data-icon="inline-start" />
        {isInviting ? "Создаём приглашение…" : "Пригласить в семью"}
      </Button>
      <FieldError>{model.failure()}</FieldError>
      {invites.length > 0 && (
        <ul className="flex flex-col gap-2 text-left">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Приглашение {invite.expiresOn}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  model.revoke(invite.id);
                }}
              >
                Отозвать
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}, "Invites");
