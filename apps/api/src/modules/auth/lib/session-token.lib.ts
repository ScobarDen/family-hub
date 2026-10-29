import { sign, verify } from "hono/jwt";

import { msPerSecond, sessionLifetimeMs } from "../auth.config.ts";

const algorithm = "HS256";

async function verifiedPayload(token: string, secret: string) {
  // hono/jwt checks `exp` against the system clock; the injected Clock is checked below instead.
  return verify(token, secret, { alg: algorithm, exp: false, nbf: false, iat: false }).catch(
    () => null,
  );
}

// An Installed App session names its Device, so revoking the Device ends the session too.
export type SessionClaims = { memberId: string; deviceId?: string };

export function createSessionTokens(secret: string) {
  return {
    async sign({ memberId, deviceId }: SessionClaims, now: number): Promise<string> {
      return sign(
        { memberId, deviceId, exp: Math.floor((now + sessionLifetimeMs) / msPerSecond) },
        secret,
        algorithm,
      );
    },

    async read(token: string, now: number): Promise<SessionClaims | undefined> {
      const payload = await verifiedPayload(token, secret);

      if (
        typeof payload?.exp !== "number" ||
        payload.exp * msPerSecond < now ||
        typeof payload.memberId !== "string"
      ) {
        return undefined;
      }

      return typeof payload.deviceId === "string"
        ? { memberId: payload.memberId, deviceId: payload.deviceId }
        : { memberId: payload.memberId };
    },
  };
}
