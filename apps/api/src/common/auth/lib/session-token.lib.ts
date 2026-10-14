import { sign, verify } from "hono/jwt";

import { msPerSecond, sessionLifetimeMs } from "../auth.config.ts";

const algorithm = "HS256";

async function verifiedPayload(token: string, secret: string) {
  // hono/jwt checks `exp` against the system clock; the injected Clock is checked below instead.
  return verify(token, secret, { alg: algorithm, exp: false, nbf: false, iat: false }).catch(
    () => null,
  );
}

export function createSessionTokens(secret: string) {
  return {
    async sign(memberId: string, now: number): Promise<string> {
      return sign(
        { memberId, exp: Math.floor((now + sessionLifetimeMs) / msPerSecond) },
        secret,
        algorithm,
      );
    },

    async read(token: string, now: number): Promise<string | undefined> {
      const payload = await verifiedPayload(token, secret);

      if (typeof payload?.exp !== "number" || payload.exp * msPerSecond < now) {
        return undefined;
      }

      return typeof payload.memberId === "string" ? payload.memberId : undefined;
    },
  };
}
