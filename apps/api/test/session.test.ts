import { describe, expect, test } from "vite-plus/test";

import { signInitData, tamperUser } from "./init-data.ts";
import { asya, denis, startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";

type Worker = ReturnType<typeof startWorker>;

function initDataFor(worker: Worker, user = denis, authDate = now) {
  return signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate });
}

async function postSession(worker: Worker, initData: string) {
  return worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData }),
  });
}

async function signIn(worker: Worker, user = denis) {
  const response = await postSession(worker, initDataFor(worker, user));
  const body = await response.json<{ token: string }>();

  return body.token;
}

async function getMe(worker: Worker, token: string) {
  return worker.request("/api/me", { headers: { authorization: `Bearer ${token}` } });
}

async function renew(worker: Worker, token: string) {
  return worker.request("/api/session/renew", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const family = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  return { worker, ...family };
}

describe("signing in with initData", () => {
  test("a Member gets a session together with who they are", async () => {
    const { worker, familyId, ownerId } = await startWithFamily();

    const response = await postSession(worker, initDataFor(worker));

    expect(await response.json()).toEqual({
      status: "member",
      token: expect.any(String),
      member: { id: ownerId, name: "Денис" },
      family: { id: familyId, name: "Гущины" },
      isFamilyOwner: true,
      settings: {
        tabBar: ["tasks", "pet"],
        timeZone: null,
        canMessage: true,
        digest: { isEnabled: true, time: "09:00" },
        reminderChannel: "both",
      },
    });
  });

  test("a Member who is not the Family Owner is told so", async () => {
    const { worker, familyId } = await startWithFamily();

    await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

    const response = await postSession(worker, initDataFor(worker, asya));

    expect(await response.json()).toMatchObject({ isFamilyOwner: false });
  });

  test("the session token knows who the Member is", async () => {
    const { worker, ownerId } = await startWithFamily();

    const me = await getMe(worker, await signIn(worker));

    expect(await me.json()).toMatchObject({ member: { id: ownerId } });
  });

  test("initData with a forged user is rejected", async () => {
    const { worker } = await startWithFamily();
    const forged = tamperUser(initDataFor(worker, asya), denis);

    const response = await postSession(worker, forged);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "INIT_DATA_INVALID" });
  });

  test("initData signed by another bot is rejected", async () => {
    const { worker } = await startWithFamily();
    const foreign = signInitData({ botToken: "other-bot-token", user: denis, authDate: now });

    const response = await postSession(worker, foreign);

    expect(response.status).toBe(401);
  });

  test("initData older than an hour is rejected", async () => {
    const { worker } = await startWithFamily();

    const response = await postSession(worker, initDataFor(worker, denis, "2026-10-04T07:59:00Z"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "INIT_DATA_INVALID" });
  });

  test("initData just under an hour old is accepted", async () => {
    const { worker } = await startWithFamily();

    const response = await postSession(worker, initDataFor(worker, denis, "2026-10-04T08:01:00Z"));

    expect(response.status).toBe(200);
  });

  test("initData dated in the future is rejected", async () => {
    const { worker } = await startWithFamily();

    const response = await postSession(worker, initDataFor(worker, denis, "2026-10-04T09:10:00Z"));

    expect(response.status).toBe(401);
  });

  test("a request without initData is rejected", async () => {
    const { worker } = await startWithFamily();

    const response = await worker.request("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(400);
  });
});

describe("a stranger", () => {
  test("is recognised as a stranger and gets no session", async () => {
    const { worker } = await startWithFamily();

    const response = await postSession(worker, initDataFor(worker, asya));

    expect(await response.json()).toEqual({ status: "stranger", familyRequest: "none" });
  });

  test("is a Member who left their Family", async () => {
    const { worker, familyId } = await startWithFamily();
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

    await worker.leaveFamily(asyaId);

    const response = await postSession(worker, initDataFor(worker, asya));

    expect(await response.json()).toEqual({ status: "stranger", familyRequest: "none" });
  });
});

describe("a session", () => {
  test("is refused without a token", async () => {
    const { worker } = await startWithFamily();

    const response = await worker.request("/api/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  test("is asked for by every record collection", async () => {
    const { worker } = await startWithFamily();
    const paths = [
      "/api/albums",
      "/api/photos",
      "/api/commands",
      "/api/feed",
      "/api/goals",
      "/api/pets",
      "/api/recipes",
      "/api/recipe-tags",
      "/api/tasks",
    ];
    const responses = await Promise.all(paths.map(async (path) => worker.request(path)));

    expect(responses.map(({ status }) => status)).toEqual(paths.map(() => 401));
  });

  test("is refused with a token signed by someone else", async () => {
    const { worker } = await startWithFamily();
    const token = await signIn(worker);
    const [header, payload] = token.split(".");

    const response = await getMe(worker, `${header}.${payload}.forged-signature`);

    expect(response.status).toBe(401);
  });

  test("lasts 24 hours", async () => {
    const { worker } = await startWithFamily();
    const token = await signIn(worker);

    worker.clock.set("2026-10-05T08:59:00Z");

    const response = await getMe(worker, token);

    expect(response.status).toBe(200);
  });

  test("expires after 24 hours", async () => {
    const { worker } = await startWithFamily();
    const token = await signIn(worker);

    worker.clock.set("2026-10-05T09:00:01Z");

    const response = await getMe(worker, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  test("ends at once when the Member leaves the Family", async () => {
    const { worker, familyId } = await startWithFamily();
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    const token = await signIn(worker, asya);

    await worker.leaveFamily(asyaId);

    const response = await getMe(worker, token);

    expect(response.status).toBe(401);
  });
});

describe("renewing a session", () => {
  test("gives a still-valid token a fresh one that lasts another 24 hours", async () => {
    const { worker } = await startWithFamily();
    const token = await signIn(worker);

    worker.clock.set("2026-10-05T08:00:00Z");

    const response = await renew(worker, token);
    const renewed = await response.json<{ token: string }>();

    worker.clock.set("2026-10-06T07:59:00Z");

    const me = await getMe(worker, renewed.token);

    expect(response.status).toBe(200);
    expect(me.status).toBe(200);
  });

  test("is refused once the token has expired", async () => {
    const { worker } = await startWithFamily();
    const token = await signIn(worker);

    worker.clock.set("2026-10-05T09:00:01Z");

    const response = await renew(worker, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  test("is refused to a Member who left the Family", async () => {
    const { worker, familyId } = await startWithFamily();
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    const token = await signIn(worker, asya);

    await worker.leaveFamily(asyaId);

    const response = await renew(worker, token);

    expect(response.status).toBe(401);
  });
});

async function preflight(worker: Worker, origin: string) {
  return worker.request("/api/session", {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
}

describe("CORS", () => {
  test.each([
    ["the Mini App on GitHub Pages", "https://scobarden.github.io", "https://scobarden.github.io"],
    ["the local dev Mini App", "http://localhost:5173", "http://localhost:5173"],
    ["no other site", "https://evil.example", null],
  ])("lets %s call the API", async (_site, origin, allowed) => {
    const worker = startWorker({ now });

    const response = await preflight(worker, origin);

    expect(response.headers.get("access-control-allow-origin")).toBe(allowed);
  });
});
