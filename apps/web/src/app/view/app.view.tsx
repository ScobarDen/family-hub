import { FamilyRequest, type FamilyRequestModel } from "@/modules/family-request";
import { JoinFamily, type JoinFamilyModel } from "@/modules/join-family";
import { Session } from "@/modules/session";

import { Home, type HomeProps } from "./home.view.tsx";

type AppProps = HomeProps & {
  familyRequest: FamilyRequestModel;
  joinFamily: JoinFamilyModel;
};

export function App({ familyRequest, joinFamily, ...home }: AppProps) {
  return (
    <Session
      model={home.session}
      familyRequest={<FamilyRequest model={familyRequest} />}
      joinFamily={<JoinFamily model={joinFamily} />}
      home={<Home {...home} />}
    />
  );
}
