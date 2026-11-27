import { onTestFinished } from "vite-plus/test";
import type { z } from "zod";

import {
  careEntry,
  careEntryList,
  deleted,
  goal,
  goalList,
  petList,
  recipe,
  recipeList,
  recipeTagList,
  task,
  taskList,
  today,
  type SessionResponse,
} from "@family-hub/contract";

const token = "session-token";

const signedIn: SessionResponse = {
  status: "member",
  token,
  member: { id: "member-1", name: "Денис" },
  family: { id: "family-1", name: "Гущины" },
  isFamilyOwner: true,
  settings: {
    tabBar: ["tasks", "goals"],
    timeZone: { timeZone: "Europe/Moscow", isAuto: true },
    canMessage: true,
    digest: { isEnabled: true, time: "09:00" },
    reminderChannel: "both",
  },
};

// What the Worker answers, by `METHOD /path`: a body to send as JSON, or a whole Response; the
// request body comes along for writes.
export type Routes = Record<string, (body: unknown) => unknown>;

export const workerFailure = Response.json(
  { code: "INTERNAL", message: "D1 is down" },
  { status: 500 },
);

// The app reads an answer it cannot parse as a failed load, so a fake answer of the wrong shape
// would only leave a test waiting; each answer is checked against what the app parses it with.
const answerSchemas: Array<[RegExp, z.ZodType]> = [
  [/^GET \/api\/today$/, today],
  [/^GET \/api\/tasks$/, taskList],
  [/^(GET|PUT) \/api\/tasks\/[^/]+$|^POST \/api\/tasks\/[^/]+\/(complete|reopen)$/, task],
  [/^GET \/api\/goals$/, goalList],
  [/^POST \/api\/goals\/[^/]+\/movements$/, goal],
  [/^GET \/api\/pets$/, petList],
  [/^GET \/api\/pets\/[^/]+\/care-entries$/, careEntryList],
  [/^GET \/api\/care-entries\/[^/]+$/, careEntry],
  [/^GET \/api\/recipes$/, recipeList],
  [/^(GET|PUT) \/api\/recipes\/[^/]+$/, recipe],
  [/^GET \/api\/recipe-tags$/, recipeTagList],
  [/^DELETE \/api\/photos\/[^/]+$/, deleted],
];

function problemWith(request: string, answer: unknown): string | undefined {
  const schema = answerSchemas.find(([route]) => route.test(request))?.[1];

  if (schema === undefined) {
    return `${request}: no schema to check its answer against, add one to answerSchemas`;
  }

  const parsed = schema.safeParse(answer);

  return parsed.success ? undefined : `${request}: ${parsed.error.message}`;
}

function bodyOf(init: RequestInit | undefined): unknown {
  return typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
}

export function fakeWorker(routes: Routes) {
  const requests: string[] = [];
  const problems: string[] = [];

  onTestFinished(() => {
    if (problems.length > 0) {
      throw new Error(`The fake Worker answered what the app cannot read:\n${problems.join("\n")}`);
    }
  });

  async function fetch(input: URL | string, init?: RequestInit): Promise<Response> {
    const request = `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`;

    requests.push(request);

    if (request === "POST /api/session") {
      return Response.json(signedIn);
    }

    const route = routes[request];

    if (route === undefined) {
      return Response.json({ code: "NOT_FOUND", message: request }, { status: 404 });
    }

    const answer = await route(bodyOf(init));

    if (answer instanceof Response) {
      return answer.clone();
    }

    const problem = problemWith(request, answer);

    if (problem !== undefined) {
      problems.push(problem);
    }

    return Response.json(answer);
  }

  return { fetch, requests };
}
