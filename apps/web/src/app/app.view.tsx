import { FamilyRequest, type FamilyRequestModel } from "@/modules/family-request";
import { Session, type SessionModel } from "@/modules/session";

type AppProps = { session: SessionModel; familyRequest: FamilyRequestModel };

export function App({ session, familyRequest }: AppProps) {
  return <Session model={session} familyRequest={<FamilyRequest model={familyRequest} />} />;
}
