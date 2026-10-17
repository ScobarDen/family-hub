import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createHttpClient } from "@/common/http-client";
import { reatomTelegram } from "@/common/telegram";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
import { createInvitesApi, reatomInvites } from "@/modules/invites";
import { createJoinFamilyApi, reatomJoinFamily } from "@/modules/join-family";
import { createSessionApi, reatomSession } from "@/modules/session";

import { App } from "./app.view.tsx";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root is missing from index.html");
}

const telegram = reatomTelegram(window.Telegram.WebApp);
const httpClient = createHttpClient({
  baseUrl: import.meta.env.VITE_API_URL ?? window.location.origin,
  fetch: async (input, init) => fetch(input, init),
});
const session = reatomSession({
  api: createSessionApi(httpClient),
  telegram,
  isJoiningFamily: () => joinFamily.isOpen(),
});
const joinFamily = reatomJoinFamily({
  api: createJoinFamilyApi(httpClient),
  telegram,
  onJoined: session.signIn,
});
const invites = reatomInvites({ api: createInvitesApi(httpClient), telegram });
const familyRequest = reatomFamilyRequest({
  api: createFamilyRequestApi(httpClient),
  telegram,
  familyRequestStatus: session.familyRequestStatus,
  onBack: session.closeFamilyRequest,
  onCheck: session.signIn,
});

telegram.launch();
telegram.followColorScheme(document.documentElement);
session.signIn();
joinFamily.load();

createRoot(root).render(
  <StrictMode>
    <App
      session={session}
      familyRequest={familyRequest}
      joinFamily={joinFamily}
      invites={invites}
    />
  </StrictMode>,
);
