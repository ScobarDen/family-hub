import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createHttpClient } from "@/common/http-client";
import { reatomTelegram } from "@/common/telegram";
import { createFamilyRequestApi, reatomFamilyRequest } from "@/modules/family-request";
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
const session = reatomSession({ api: createSessionApi(httpClient), telegram });
const familyRequest = reatomFamilyRequest({
  api: createFamilyRequestApi(httpClient),
  telegram,
  onBack: session.closeFamilyRequest,
  onCheck: session.signIn,
});

telegram.launch();
telegram.followColorScheme(document.documentElement);
session.signIn();

createRoot(root).render(
  <StrictMode>
    <App session={session} familyRequest={familyRequest} />
  </StrictMode>,
);
