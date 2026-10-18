import { FamilyRequest, type FamilyRequestModel } from "@/modules/family-request";
import { Invites, type InvitesModel } from "@/modules/invites";
import { JoinFamily, type JoinFamilyModel } from "@/modules/join-family";
import { Session, type SessionModel } from "@/modules/session";

type AppProps = {
  session: SessionModel;
  familyRequest: FamilyRequestModel;
  joinFamily: JoinFamilyModel;
  invites: InvitesModel;
};

export function App({ session, familyRequest, joinFamily, invites }: AppProps) {
  return (
    <Session
      model={session}
      familyRequest={<FamilyRequest model={familyRequest} />}
      joinFamily={<JoinFamily model={joinFamily} />}
      invites={<Invites model={invites} />}
    />
  );
}
