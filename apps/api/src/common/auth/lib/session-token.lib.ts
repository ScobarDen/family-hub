import { sign, verify } from "hono/jwt";

const lifetimeMs = 86_400_000;
const msPerSecond = 1000;
const algorithm = "HS256";

type SignSessionTokenOptions = {
  memberId: string;
  secret: string;
  now: number;
};

type ReadSessionTokenOptions = {
  token: string;
  secret: string;
  now: number;
};

export async function signSessionToken({
  memberId,
  secret,
  now,
}: SignSessionTokenOptions): Promise<string> {
  return sign({ memberId, exp: Math.floor((now + lifetimeMs) / msPerSecond) }, secret, algorithm);
}

async function verifiedPayload(token: string, secret: string) {
  // hono/jwt checks `exp` against the system clock; the injected Clock is checked below instead.
  return verify(token, secret, { alg: algorithm, exp: false, nbf: false, iat: false }).catch(
    () => null,
  );
}

export async function readSessionToken({
  token,
  secret,
  now,
}: ReadSessionTokenOptions): Promise<string | undefined> {
  const payload = await verifiedPayload(token, secret);

  if (typeof payload?.exp !== "number" || payload.exp * msPerSecond < now) {
    return undefined;
  }

  return typeof payload.memberId === "string" ? payload.memberId : undefined;
}
