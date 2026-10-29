import { fromBase64Url, toBase64Url } from "@/common/base64url.lib.ts";

const tokenLifetimeSeconds = 43_200;
const msPerSecond = 1000;
const pointPrefixBytes = 1;
const coordinateBytes = 32;

// The VAPID key pair as `web-push generate-vapid-keys` prints it: the raw public point and the
// private scalar, both base64url.
export type Vapid = { publicKey: string; privateKey: string; subject: string };

const encoder = new TextEncoder();

// A raw uncompressed P-256 point and its scalar as the JWK WebCrypto imports a private key from.
export function privateJwkOf(publicKey: Uint8Array, privateKey: string): JsonWebKey {
  const xEnd = pointPrefixBytes + coordinateBytes;

  /* oxlint-disable eslint/id-length -- JWK names its fields x, y and d */
  return {
    kty: "EC",
    crv: "P-256",
    x: toBase64Url(publicKey.slice(pointPrefixBytes, xEnd)),
    y: toBase64Url(publicKey.slice(xEnd, xEnd + coordinateBytes)),
    d: privateKey,
  };
  /* oxlint-enable eslint/id-length */
}

function jsonPart(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

async function signingKeyOf({ publicKey, privateKey }: Vapid): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    privateJwkOf(fromBase64Url(publicKey), privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// RFC 8292: an ES256 JWT for the push service's origin, sent with the key that signed it.
export async function vapidAuthorization(
  vapid: Vapid,
  { endpoint, now }: { endpoint: string; now: number },
): Promise<string> {
  const unsigned = `${jsonPart({ typ: "JWT", alg: "ES256" })}.${jsonPart({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / msPerSecond) + tokenLifetimeSeconds,
    sub: vapid.subject,
  })}`;
  // WebCrypto's ECDSA signature is already the raw r || s that JWS wants.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await signingKeyOf(vapid),
    encoder.encode(unsigned),
  );

  return `vapid t=${unsigned}.${toBase64Url(new Uint8Array(signature))}, k=${vapid.publicKey}`;
}
