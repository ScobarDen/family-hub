import { FamilyRequest, type FamilyRequestModel } from "@/modules/family-request";
import { JoinFamily, type JoinFamilyModel } from "@/modules/join-family";
import { Session } from "@/modules/session";
import { WideWindow } from "@/modules/ui";

import { Home, type HomeProps } from "./home.view.tsx";

type AppProps = HomeProps & {
  isWide: () => boolean;
  familyRequest: FamilyRequestModel;
  joinFamily: JoinFamilyModel;
};

export function App({ isWide, familyRequest, joinFamily, ...home }: AppProps) {
  return (
    <WideWindow isWide={isWide}>
      <Session
        model={home.session}
        familyRequest={<FamilyRequest model={familyRequest} />}
        joinFamily={<JoinFamily model={joinFamily} />}
        home={<Home {...home} />}
      />
    </WideWindow>
  );
}
